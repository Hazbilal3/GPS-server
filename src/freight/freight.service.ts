import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { uploadBufferToS3 } from '../s3.storage';
import { PrismaService } from '../prisma.service';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const BASE_PROMPT = `You are a freight order parser. Extract all available fields from this document.
Return ONLY valid JSON — no markdown fences, no explanation, nothing else.
Use null for any missing field.

JSON structure:
{
  "loadNumber": "airbill / BOL / order number at top of doc",
  "orig": "origin airport or hub code (e.g. BDL, EWR)",
  "dest": "destination airport or hub code",
  "serviceType": "service level (Next Day, Same Day, Ground, etc.)",
  "shipmentValue": "shipment value (e.g. NVD or dollar amount)",
  "pickupDate": "YYYY-MM-DD or null",
  "deliveryDate": "YYYY-MM-DD or null (delivery deadline date)",
  "deliveryTime": "HH:MM or null (delivery deadline time, 24h)",
  "pickupCompany": "shipper / pickup company name",
  "pickupAddress": "street address only (no city/state/zip)",
  "pickupCity": "city",
  "pickupState": "2-letter state code",
  "pickupZip": "zip code",
  "pickupPhone": "phone number or null",
  "pickupContact": "contact person or null",
  "pickupReadyTime": "HH:MM or null",
  "pickupCloseTime": "HH:MM or null",
  "deliveryCompany": "consignee / delivery company name",
  "deliveryAddress": "street address only (no city/state/zip)",
  "deliveryCity": "city",
  "deliveryState": "2-letter state code",
  "deliveryZip": "zip code",
  "deliveryContact": "contact person or null",
  "deliveryOpenTime": "HH:MM or null",
  "deliveryCloseTime": "HH:MM or null",
  "poNumber": "PO number or null",
  "soNumber": "SO number or null",
  "invoiceRef": "Invoice number or null",
  "reference1": "Reference 1 value or null",
  "reference2": "Reference 2 value or null",
  "reference3": "Reference 3 value or null",
  "additionalServices": "comma-separated additional services or null",
  "pieces": 0,
  "weight": 0,
  "cargoLength": 0,
  "cargoWidth": 0,
  "cargoHeight": 0,
  "cargoExt": 0,
  "cargoDim": "DIM value or null",
  "packageType": "Carton / Pallet / etc.",
  "commodity": "cargo description",
  "specialInstructions": "special instructions text or null"
}`;

const COMPANY_HINTS: Record<string, string> = {
  BTX: `This is a BTX Global Logistics BTXBOL document. Key locations:
- Top right: Airbill Number → loadNumber
- PICKUP DATE, ORIG, DEST fields in header row
- SERVICE REQUESTED field (e.g. "Next Day")
- SHIPMENT VALUE and DELIVERY DEADLINE fields
- SHIPPER INFORMATION block → pickup fields
- LOCATION INFORMATION row: READY TIME and CLOSE TIME → pickupReadyTime, pickupCloseTime
- CONSIGNEE INFORMATION block → delivery fields
- LOCATION INFORMATION row: OPEN TIME and CLOSE TIME → deliveryOpenTime, deliveryCloseTime
- REFERENCE MARKS/NUMBERS table: PO Number, SO Number, Invoice Number, Reference 1/2/3
- ADDITIONAL SERVICES REQUESTED column
- SPECIAL INSTRUCTIONS section at bottom

CARGO TABLE — read each column independently, do NOT concatenate values:
  PCS  = pieces (number of packages, e.g. 2)
  WT   = weight in pounds (e.g. 500)
  LEN  = length in inches (e.g. 48)
  WTH  = width in inches (e.g. 40)
  HGT  = height in inches (e.g. 48)
  EXT  = extended/cubic value (e.g. 1000)
  DIM  = dimensional weight (often blank)
  PACKAGE TYPE = type of packaging (e.g. Carton)
  DESCRIPTION  = cargo description (e.g. exhibit)
Read only the FIRST data row of the table (ignore the totals row at the bottom).
Map: PCS→pieces, WT→weight, LEN→cargoLength, WTH→cargoWidth, HGT→cargoHeight, EXT→cargoExt, DIM→cargoDim`,
  BOL_OKEE: `This is a Bill of Lading – Short Form (BOL_OKEE / Okeechobee Industries).

Document structure:
- Date at top left (e.g. "August 17, 2026") → pickupDate (YYYY-MM-DD)
- "Bill of Lading Number:" field top right → loadNumber (may be blank)
- orig and dest are null (ground transport, no airport codes)

SHIP FROM section → PICKUP:
- First line = pickupCompany
- Second line = pickupAddress (street only)
- "CITY, STATE ZIP" line → pickupCity, pickupState, pickupZip
- Ignore "SID No." line
- Any "SPECIAL HANDELING" or handling note → specialInstructions

SHIP TO section → DELIVERY:
- First 1-2 lines = deliveryCompany (may span two lines, take all before the address)
- Street address line → deliveryAddress
- "CITY, STATE ZIP" → deliveryCity, deliveryState, deliveryZip
- Last line with a phone number → deliveryContact (name part only), deliveryPhone

CUSTOMER ORDER INFORMATION table:
- "Customer Order No." → reference1
- "# of Packages" column rows (e.g. "7 WOOD DOORS", "6 KNOCK DOWN FRAMES", "HARDWARE") → combine all into commodity as comma-separated string
- "Weight" column: strip text like "LBS PER", sum all numeric weights → weight (total number)
- "Additional Shipper Information" → append to commodity if different

CARRIER INFORMATION table:
- "Qty" column (Handling Unit) → pieces
- "Type" column (Handling Unit) → packageType (e.g. SKID)
- "Commodity Description" rows → use as commodity if more complete

Ignore all handwritten text, signatures, and checkboxes.
agreedRate, driverPay, pickupReadyTime, pickupCloseTime, deliveryTime → null`,
  BOL_MERGE: `This is a Bill of Lading from Merge. Extract all shipper, consignee, cargo, and reference fields as accurately as possible.`,
  RATE_CON: `This is a Rate Agreement / Rate Confirmation from a freight broker (e.g. ALL STATES TRANSPORT, INC.).

Field locations:
- "Load #: XXXXXX" near the top → loadNumber
- orig and dest are null (this is ground transport, no airport codes)
- shipmentValue: look for "Total Load Value: ..." text

PICKUP — the "S/" section (Shipper):
- Company name is the first line after the "S/ ====" separator
- Street address is the next line
- "CITY, STATE ZIP" line → pickupCity, pickupState, pickupZip
- "P/U Date/Time: MM/DD/YYYY - H:MM AM - H:MM AM" → pickupDate (convert to YYYY-MM-DD), pickupReadyTime (first time as HH:MM 24h), pickupCloseTime (second time as HH:MM 24h)
- "Weight: NNN  Pieces: N  Commodity: TEXT" → weight (number), pieces (number), commodity

DELIVERY — the "C/" section (Consignee):
- Company name is first line after "C/ ====" separator. If a phone number appears on the same line (e.g. "COMPANY NAME 339-613-7222"), strip the phone → deliveryCompany, deliveryPhone
- Street address may include "Contact: NAME" → deliveryAddress (street only), deliveryContact
- "CITY, STATE ZIP" → deliveryCity, deliveryState, deliveryZip
- "Del Date/Time: MM/DD/YYYY - H:MM AM - H:MM PM" → deliveryDate (YYYY-MM-DD), deliveryOpenTime (first time), deliveryCloseTime (second time)

OTHER:
- "Equipment Required: TYPE" → serviceType
- DO NOT extract any dollar amounts or rates → leave agreedRate as null
- Leave poNumber, soNumber, reference1/2/3 as null unless explicitly labeled`,
};

// Gemini models to try in order for scanned/image PDFs
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.5-pro'];

@Injectable()
export class FreightService {
  private groq: Groq;
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaService, private mail: MailService) {
    this.groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
  }

  // ── PDF Parsing ──────────────────────────────────────────
  async parseOrderPdf(fileBuffer: Buffer, _mimeType: string, company?: string): Promise<any> {
    const hint = company ? (COMPANY_HINTS[company] ?? '') : '';
    const fullPrompt = hint ? `${BASE_PROMPT}\n\n${hint}` : BASE_PROMPT;

    // Detect scanned/image PDF — pdf-parse returns almost no text
    let extractedText = '';
    try {
      const parsed = await pdfParse(fileBuffer);
      extractedText = (parsed.text ?? '').trim();
    } catch { /* ignore parse errors for image PDFs */ }

    const isScanned = extractedText.length < 150;
    console.log(`[PDF] text length=${extractedText.length}, isScanned=${isScanned}, company=${company}`);

    if (isScanned) {
      return this.parseWithGemini(fileBuffer, fullPrompt, company);
    } else {
      return this.parseWithGroq(extractedText, fullPrompt, company);
    }
  }

  private async parseWithGroq(text: string, fullPrompt: string, company?: string): Promise<any> {
    try {
      const chat = await this.groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        temperature: 0,
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: `Extract fields from this freight document:\n\n${text}` },
        ],
      });

      const raw = chat.choices[0]?.message?.content ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { _parseError: 'AI returned no JSON. Fill fields manually.' };

      let result: any;
      try { result = JSON.parse(jsonMatch[0]); }
      catch { return { _parseError: 'AI returned malformed JSON. Fill fields manually.' }; }

      if (company === 'BTX') {
        const cargo = this.parseBtxCargo(text);
        if (cargo) Object.assign(result, cargo);
      }

      return result;
    } catch (err: any) {
      return { _parseError: `Groq error: ${err?.message ?? 'unknown'}. Fill fields manually.` };
    }
  }

  private async parseWithGemini(fileBuffer: Buffer, fullPrompt: string, company?: string): Promise<any> {
    const b64 = fileBuffer.toString('base64');
    for (const modelName of GEMINI_MODELS) {
      try {
        console.log(`[Gemini] trying model: ${modelName}`);
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json', temperature: 0 } as any,
        });
        const result = await model.generateContent([
          { text: fullPrompt },
          { inlineData: { mimeType: 'application/pdf', data: b64 } },
        ]);
        const raw = result.response.text();
        try { return JSON.parse(raw); }
        catch { return { _parseError: 'Gemini returned malformed JSON. Fill fields manually.' }; }
      } catch (err: any) {
        console.log(`[Gemini] ${modelName} failed: ${err?.message}`);
        // try next model
      }
    }
    return { _parseError: 'Scanned PDF — all vision models failed. Fill fields manually.' };
  }

  private parseBtxCargo(text: string): Record<string, number> | null {
    try {
      // Step 1: find cargo row — long number (6+ digits) after the "PCSWTLEN" header
      const headerIdx = text.indexOf('PCSWTLEN');
      if (headerIdx === -1) return null;
      const cargoMatch = text.slice(headerIdx).match(/(\d{6,})/);
      if (!cargoMatch) return null;
      const cargo = cargoMatch[1]; // e.g. "25004840481000"

      // Step 2: find totals row — the number right before "Units: English"
      // The totals row is PCS and EXT concatenated: "21000" = PCS(2) + EXT(1000)
      const totalsMatch = text.match(/(\d+)\s*\n\s*Units:\s*English/i);
      if (!totalsMatch) return null;
      const totals = totalsMatch[1]; // e.g. "21000"

      // Step 3: try splitting totals into PCS (1–3 digits) + EXT (rest)
      // Verify by checking cargo string starts with PCS and ends with EXT
      let pcs = 0, ext = 0, found = false;
      for (let n = 1; n <= 3; n++) {
        const p = parseInt(totals.slice(0, n));
        const e = parseInt(totals.slice(n));
        if (p > 0 && e > 0 && cargo.startsWith(String(p)) && cargo.endsWith(String(e))) {
          pcs = p; ext = e; found = true;
          break;
        }
      }
      if (!found) return null;

      // Step 4: strip PCS and EXT → middle = WT + LEN + WTH + HGT
      const middle = cargo.slice(String(pcs).length, cargo.length - String(ext).length);
      if (middle.length < 6) return null;

      // LEN, WTH, HGT are 2 digits each; WT takes the leading remainder
      const hgt = parseInt(middle.slice(-2));
      const wth = parseInt(middle.slice(-4, -2));
      const len = parseInt(middle.slice(-6, -4));
      const wt  = parseInt(middle.slice(0, middle.length - 6));

      if (wt <= 0 || len < 10 || wth < 10 || hgt < 10) return null;
      return { pieces: pcs, weight: wt, cargoLength: len, cargoWidth: wth, cargoHeight: hgt, cargoExt: ext };
    } catch {
      return null;
    }
  }

  // ── Loads ────────────────────────────────────────────────
  async getLoads() {
    return this.prisma.freightLoad.findMany({
      include: { driver: true, truck: true, milestones: { orderBy: { recordedAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLoad(id: number) {
    const load = await this.prisma.freightLoad.findUnique({
      where: { id },
      include: {
        driver: true,
        truck: true,
        milestones: { orderBy: { recordedAt: 'asc' } },
        documents: true,
        preTripInspections: { include: { driver: true } },
        clockSessions: { include: { driver: true, truck: true } },
        expenses: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!load) throw new NotFoundException('Load not found');
    return load;
  }

  async createLoad(data: any) {
    return this.prisma.freightLoad.create({ data: this.sanitizeDates(data) });
  }

  async updateLoad(id: number, data: any) {
    return this.prisma.freightLoad.update({ where: { id }, data: this.sanitizeDates(data) });
  }

  async deleteLoad(id: number) {
    return this.prisma.freightLoad.delete({ where: { id } });
  }

  private sanitizeDates(data: any): any {
    const out = { ...data };
    for (const key of ['pickupDate', 'deliveryDate']) {
      if (out[key] && typeof out[key] === 'string') {
        out[key] = new Date(out[key] + 'T00:00:00.000Z');
      }
    }
    return out;
  }

  async assignLoad(id: number, driverId?: number, truckId?: number) {
    const data: any = { status: 'assigned' };
    if (driverId) data.driverId = driverId;
    if (truckId)  data.truckId  = truckId;
    return this.prisma.freightLoad.update({ where: { id }, data });
  }

  async updateStatus(id: number, status: string, notes?: string) {
    const data: any = { status };
    if (notes) data.internalNotes = notes;

    // Auto-set POD timestamp
    if (status === 'pod_received') data.podUploadedAt = new Date();

    await this.prisma.freightLoad.update({ where: { id }, data });

    // Record milestone
    const MILESTONE_MAP: Record<string, string> = {
      clocked_in: 'clocked_in',
      en_route_pickup: 'en_route_pickup',
      at_pickup: 'arrived_pickup',
      loaded: 'loaded',
      in_transit: 'in_transit',
      at_delivery: 'arrived_delivery',
      delivered: 'delivered',
      pod_received: 'pod_uploaded',
    };
    if (MILESTONE_MAP[status]) {
      await this.prisma.freightMilestone.create({
        data: { loadId: id, milestone: MILESTONE_MAP[status] },
      });
    }

    return this.prisma.freightLoad.findUnique({ where: { id }, include: { milestones: true } });
  }

  // ── Drivers ──────────────────────────────────────────────
  async getDrivers() {
    return this.prisma.freightDriver.findMany({ orderBy: { name: 'asc' } });
  }

  async createDriver(data: any) {
    return this.prisma.freightDriver.create({ data });
  }

  async updateDriver(id: number, data: any) {
    return this.prisma.freightDriver.update({ where: { id }, data });
  }

  async deleteDriver(id: number) {
    return this.prisma.freightDriver.update({ where: { id }, data: { status: 'inactive' } });
  }

  // ── Trucks ───────────────────────────────────────────────
  async getTrucks() {
    return this.prisma.freightTruck.findMany({ orderBy: { name: 'asc' } });
  }

  async createTruck(data: any) {
    return this.prisma.freightTruck.create({ data });
  }

  async updateTruck(id: number, data: any) {
    return this.prisma.freightTruck.update({ where: { id }, data });
  }

  // ── Dashboard Stats ──────────────────────────────────────
  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    // Last 7 days window
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    const [
      activeLoads,
      todayPickups,
      todayDeliveries,
      missingPods,
      readyToBill,
      totalAR,
      totalPaid,
      statusGroups,
      recentLoads,
      weekPickups,
      weekDeliveries,
    ] = await Promise.all([
      this.prisma.freightLoad.count({
        where: { status: { notIn: ['paid', 'closed', 'unassigned'] } },
      }),
      this.prisma.freightLoad.count({
        where: { pickupDate: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.freightLoad.count({
        where: { deliveryDate: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.freightLoad.count({ where: { status: 'delivered', podUrl: null } }),
      this.prisma.freightLoad.count({ where: { status: { in: ['pod_received', 'ready_for_billing'] } } }),
      this.prisma.freightLoad.aggregate({
        where: { billingStatus: { in: ['sent', 'partial'] } },
        _sum: { invoiceAmount: true },
      }),
      this.prisma.freightLoad.aggregate({
        where: { billingStatus: 'paid' },
        _sum: { invoiceAmount: true },
      }),
      this.prisma.freightLoad.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.freightLoad.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          loadNumber: true,
          status: true,
          orig: true,
          dest: true,
          pickupCity: true,
          pickupState: true,
          deliveryCity: true,
          deliveryState: true,
          pickupDate: true,
          invoiceAmount: true,
          driver: { select: { name: true } },
        },
      }),
      // Weekly pickups per day
      this.prisma.freightLoad.findMany({
        where: { pickupDate: { gte: weekStart, lte: todayEnd } },
        select: { pickupDate: true },
      }),
      // Weekly deliveries per day
      this.prisma.freightLoad.findMany({
        where: { deliveryDate: { gte: weekStart, lte: todayEnd } },
        select: { deliveryDate: true },
      }),
    ]);

    // Build 7-day trend array
    const days: { label: string; pickups: number; deliveries: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({
        label,
        pickups:    weekPickups.filter(r    => r.pickupDate?.toISOString().slice(0, 10) === dStr).length,
        deliveries: weekDeliveries.filter(r => r.deliveryDate?.toISOString().slice(0, 10) === dStr).length,
      });
    }

    return {
      activeLoads,
      todayPickups,
      todayDeliveries,
      missingPods,
      readyToBill,
      totalAR:    totalAR._sum.invoiceAmount ?? 0,
      totalPaid:  totalPaid._sum.invoiceAmount ?? 0,
      statusBreakdown: statusGroups.map(g => ({ status: g.status, count: g._count._all })),
      weeklyTrend: days,
      recentLoads,
    };
  }

  // ── Admin: set freight driver login credentials ───────────
  async setDriverCredentials(id: number, email: string, password: string) {
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    const hashed = await bcrypt.hash(password, 10);
    await this.prisma.freightDriver.update({
      where: { id },
      data: { email, passwordHash: hashed },
    });
    return { success: true };
  }

  // ── Driver: profile ───────────────────────────────────────
  async getDriverProfile(freightDriverId: number) {
    const driver = await this.prisma.freightDriver.findUnique({
      where: { id: freightDriverId },
      select: { id: true, name: true, email: true, phone: true, licenseNumber: true, hourlyRate: true, status: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  // ── Driver: settlement (payroll summary) ──────────────────
  async getDriverSettlement(freightDriverId: number) {
    const loads = await this.prisma.freightLoad.findMany({
      where: {
        driverId: freightDriverId,
        status: { in: ['pod_received', 'ready_for_billing', 'invoice_review', 'invoiced', 'awaiting_payment', 'payment_overdue', 'paid', 'closed'] },
      },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCompany: true, deliveryCompany: true,
        pickupCity: true, deliveryCity: true,
        pickupDate: true, deliveryDate: true,
        driverPay: true, driverPayStatus: true, driverPaidAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const paid    = loads.filter(l => l.driverPayStatus === 'paid');
    const pending = loads.filter(l => l.driverPayStatus !== 'paid');

    const totalPaid    = paid.reduce((s, l) => s + (l.driverPay ?? 0), 0);
    const totalPending = pending.reduce((s, l) => s + (l.driverPay ?? 0), 0);

    return { loads, summary: { totalLoads: loads.length, totalPaid, totalPending } };
  }

  // ── Driver: my loads ──────────────────────────────────────
  async getDriverLoads(freightDriverId: number) {
    return this.prisma.freightLoad.findMany({
      where: { driverId: freightDriverId },
      include: { truck: { select: { id: true, name: true, plateNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Driver: single load ───────────────────────────────────
  async getDriverLoad(freightDriverId: number, loadId: number) {
    const load = await this.prisma.freightLoad.findUnique({
      where: { id: loadId },
      include: {
        truck: { select: { id: true, name: true, plateNumber: true } },
        milestones: { orderBy: { recordedAt: 'asc' } },
        preTripInspections: { orderBy: { completedAt: 'desc' }, take: 1 },
        clockSessions: { orderBy: { clockInAt: 'desc' }, take: 1 },
      },
    });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');
    return load;
  }

  // ── Driver: clock in ─────────────────────────────────────
  async driverClockIn(freightDriverId: number, loadId: number) {
    const load = await this.prisma.freightLoad.findUnique({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');
    await this.prisma.freightClockSession.create({
      data: { loadId, driverId: freightDriverId, truckId: load.truckId ?? undefined, clockInAt: new Date() },
    });
    await this.prisma.freightMilestone.create({ data: { loadId, milestone: 'clocked_in' } });
    return this.prisma.freightLoad.update({ where: { id: loadId }, data: { status: 'clocked_in' } });
  }

  // ── Driver: clock out ────────────────────────────────────
  async driverClockOut(freightDriverId: number, loadId: number) {
    const load = await this.prisma.freightLoad.findUnique({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');
    const session = await this.prisma.freightClockSession.findFirst({
      where: { loadId, driverId: freightDriverId, clockOutAt: null },
      orderBy: { clockInAt: 'desc' },
    });
    if (session) {
      const now = new Date();
      const minutes = Math.round((now.getTime() - session.clockInAt.getTime()) / 60000);
      await this.prisma.freightClockSession.update({
        where: { id: session.id },
        data: { clockOutAt: now, totalMinutes: minutes },
      });
    }
    await this.prisma.freightMilestone.create({ data: { loadId, milestone: 'clocked_out' } });
    return { success: true };
  }

  // ── Driver: log action (milestone + optional status change) ──
  async driverAction(freightDriverId: number, loadId: number, action: string) {
    const load = await this.prisma.freightLoad.findUnique({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');

    const STATUS_ACTIONS: Record<string, string> = {
      in_transit: 'in_transit',
      delivered:  'delivered',
    };

    await this.prisma.freightMilestone.create({ data: { loadId, milestone: action } });

    const newStatus = STATUS_ACTIONS[action];
    if (newStatus) {
      return this.prisma.freightLoad.update({ where: { id: loadId }, data: { status: newStatus } });
    }
    return this.prisma.freightLoad.findUnique({ where: { id: loadId } });
  }

  // ── Driver: submit pre-trip ───────────────────────────────
  async submitPreTrip(freightDriverId: number, loadId: number, data: any) {
    const load = await this.prisma.freightLoad.findUnique({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');

    const CRITICAL = ['license', 'brakes', 'tires', 'lights'];
    const passed = !CRITICAL.some(k => data[k] === false);

    const inspection = await this.prisma.freightPreTrip.create({
      data: {
        loadId,
        driverId: freightDriverId,
        license:          data.license          ?? null,
        medicalCard:      data.medicalCard      ?? null,
        registration:     data.registration     ?? null,
        insurance:        data.insurance        ?? null,
        logbookEld:       data.logbookEld       ?? null,
        lights:           data.lights           ?? null,
        horn:             data.horn             ?? null,
        tires:            data.tires            ?? null,
        lugNuts:          data.lugNuts          ?? null,
        windshield:       data.windshield       ?? null,
        wipers:           data.wipers           ?? null,
        washerFluid:      data.washerFluid      ?? null,
        mirrors:          data.mirrors          ?? null,
        brakes:           data.brakes           ?? null,
        leaks:            data.leaks            ?? null,
        fuel:             data.fuel             ?? null,
        bolPaperwork:     data.bolPaperwork     ?? null,
        palletJack:       data.palletJack       ?? null,
        strapsSecurement: data.strapsSecurement ?? null,
        notes:            data.notes            ?? null,
        passed,
      },
    });

    if (passed) {
      await this.prisma.freightLoad.update({ where: { id: loadId }, data: { status: 'pre_trip_complete' } });
    }

    return { passed, inspection };
  }

  // ── Driver: upload POD ───────────────────────────────────
  async uploadPod(freightDriverId: number, loadId: number, file: Express.Multer.File) {
    const load = await this.prisma.freightLoad.findUnique({
      where: { id: loadId },
      include: { driver: true },
    });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');

    const url = await uploadBufferToS3('freight/pod', file.buffer, file.originalname, file.mimetype);
    const podUploadedAt = new Date();

    // Auto-calculate driver pay from hourly rate × actual hours worked
    let calculatedDriverPay: number | undefined;
    if (load.driver?.hourlyRate) {
      const sessions = await this.prisma.freightClockSession.findMany({ where: { loadId } });
      const totalMinutes = sessions.reduce((sum, s) => {
        if (s.totalMinutes != null) return sum + s.totalMinutes;
        // Session still open — count to POD upload time
        if (!s.clockOutAt) {
          return sum + Math.round((podUploadedAt.getTime() - s.clockInAt.getTime()) / 60000);
        }
        return sum;
      }, 0);
      const hours = totalMinutes / 60;
      calculatedDriverPay = Math.round(hours * load.driver.hourlyRate * 100) / 100;
    }

    await this.prisma.freightLoad.update({
      where: { id: loadId },
      data: {
        podUrl: url,
        podUploadedAt,
        status: 'pod_received',
        ...(calculatedDriverPay != null ? { driverPay: calculatedDriverPay } : {}),
      },
    });
    await this.prisma.freightMilestone.create({ data: { loadId, milestone: 'pod_uploaded' } });

    return { podUrl: url, driverPay: calculatedDriverPay };
  }

  // ── Billing: get invoice data for preview ────────────────
  async getInvoiceData(loadId: number) {
    const load = await this.prisma.freightLoad.findUnique({
      where: { id: loadId },
      include: { driver: true, truck: true },
    });
    if (!load) throw new NotFoundException('Load not found');
    return load;
  }

  // ── Billing: send invoice email ──────────────────────────
  async sendInvoice(
    loadId: number,
    invoicePdfBuffer: Buffer,
    extraDocBuffer: Buffer | null,
    extraDocName: string | null,
    body: {
      recipientEmail: string;
      billingCompany: string;
      billingContact: string;
      billingPhone: string;
      paymentTerms: string;
      notes: string;
      amount?: string;
    },
  ) {
    const load = await this.prisma.freightLoad.findUnique({
      where: { id: loadId },
      include: { documents: true },
    });
    if (!load) throw new NotFoundException('Load not found');
    if (!body.recipientEmail) throw new BadRequestException('Recipient email is required');

    // Atomic counter — never reuses a number even if loads are deleted
    const counter = await (this.prisma as any).invoiceCounter.upsert({
      where: { id: 1 },
      create: { id: 1, lastNum: 6257 },
      update: { lastNum: { increment: 1 } },
    });
    const invoiceNumber = String(counter.lastNum);

    // Calculate due date from payment terms (e.g. "Net 30" → +30 days)
    const today = new Date();
    const daysMatch = (body.paymentTerms ?? 'Net 30').match(/\d+/);
    const days = daysMatch ? parseInt(daysMatch[0], 10) : 30;
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + days);

    const amount = body.amount ? parseFloat(body.amount) : (load.agreedRate ?? 0);

    // Build attachments
    const attachments: { filename: string; content: Buffer }[] = [
      { filename: `Invoice-${invoiceNumber}.pdf`, content: invoicePdfBuffer },
    ];
    // Auto-attach order documents (rate confirmations, BOLs, etc.)
    const orderDocs = load.documents ?? [];
    for (const doc of orderDocs) {
      if (doc.type === 'invoice') continue; // skip previously generated invoices
      try {
        const docRes = await fetch(doc.fileUrl);
        if (docRes.ok) {
          const docBuf = Buffer.from(await docRes.arrayBuffer());
          attachments.push({ filename: doc.fileName, content: docBuf });
        }
      } catch {
        // non-fatal — skip this document
      }
    }
    // Manually attached admin document
    if (extraDocBuffer && extraDocName) {
      attachments.push({ filename: extraDocName, content: extraDocBuffer });
    }

    // Email HTML — full invoice layout
    const pickupCity = (load as any).pickupCity ?? '';
    const pickupState = (load as any).pickupState ?? '';
    const deliveryCity = (load as any).deliveryCity ?? '';
    const deliveryState = (load as any).deliveryState ?? '';
    const routeDesc = [[pickupCity, pickupState].filter(Boolean).join(', '), [deliveryCity, deliveryState].filter(Boolean).join(', ')].filter(Boolean).join(' TO ') || (load.loadNumber ?? `Load #${load.id}`);
    const invoiceDateStr = today.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#fff;color:#111827;">
        <div style="background:#1e3a8a;height:8px;width:100%;"></div>
        <div style="padding:28px 40px 20px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-weight:700;color:#1e3a8a;font-size:15px;">Expedited Transport Services LLC</div>
            <div style="font-weight:700;color:#1e3a8a;font-size:15px;">MC 897804</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">268 Trout Brook Dr., West Hartford, CT 06110, UNITED STATES</div>
            <div style="font-size:12px;color:#6b7280;">c.taveras@expeditedtransportservices.net</div>
            <div style="font-size:12px;color:#2563eb;text-decoration:underline;">www.expeditedtransportservices.net</div>
          </div>
        </div>
        <div style="padding:0 40px 20px;">
          <div style="font-size:32px;font-weight:900;color:#1e3a8a;margin-bottom:16px;">Invoice</div>
          <table style="border-collapse:collapse;">
            <tr><td style="font-weight:700;padding-right:16px;padding-bottom:4px;font-size:13px;">Invoice No.:</td><td style="font-size:13px;padding-bottom:4px;">${invoiceNumber}</td></tr>
            <tr><td style="font-weight:700;padding-right:16px;padding-bottom:4px;font-size:13px;">Invoice Date:</td><td style="font-size:13px;padding-bottom:4px;">${invoiceDateStr}</td></tr>
            <tr><td style="font-weight:700;padding-right:16px;padding-bottom:4px;font-size:13px;">Reference:</td><td style="font-size:13px;padding-bottom:4px;">${load.loadNumber ?? ''}</td></tr>
            <tr><td style="font-weight:700;padding-right:16px;padding-bottom:4px;font-size:13px;">Due Date:</td><td style="font-size:13px;padding-bottom:4px;">${dueDateStr}</td></tr>
          </table>
        </div>
        <div style="padding:0 40px 24px;">
          <div style="font-size:13px;font-weight:700;color:#6b7280;margin-bottom:6px;">Invoice for</div>
          <div style="font-weight:700;font-size:13px;">${body.billingCompany}</div>
          ${body.billingContact ? `<div style="font-size:13px;">${body.billingContact}</div>` : ''}
          ${body.recipientEmail ? `<div style="font-size:13px;">${body.recipientEmail}</div>` : ''}
          ${body.billingPhone ? `<div style="font-size:13px;">${body.billingPhone}</div>` : ''}
        </div>
        <div style="border-top:1px solid #e5e7eb;margin:0 40px;"></div>
        <div style="padding:0 40px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="padding:10px 8px;text-align:left;color:#2563eb;font-weight:700;font-size:13px;border-bottom:2px solid #e5e7eb;">Description</th>
                <th style="padding:10px 8px;text-align:right;color:#2563eb;font-weight:700;font-size:13px;border-bottom:2px solid #e5e7eb;">Qty</th>
                <th style="padding:10px 8px;text-align:right;color:#2563eb;font-weight:700;font-size:13px;border-bottom:2px solid #e5e7eb;">Unit price</th>
                <th style="padding:10px 8px;text-align:right;color:#2563eb;font-weight:700;font-size:13px;border-bottom:2px solid #e5e7eb;">Total price</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background:#f3f4f6;">
                <td style="padding:10px 8px;font-size:13px;">${routeDesc}</td>
                <td style="padding:10px 8px;text-align:right;font-size:13px;">1</td>
                <td style="padding:10px 8px;text-align:right;font-size:13px;">$${amount.toFixed(2)}</td>
                <td style="padding:10px 8px;text-align:right;font-size:13px;">$${amount.toFixed(2)}</td>
              </tr>
              ${body.notes ? `<tr><td colspan="4" style="padding:10px 8px;font-size:12px;color:#6b7280;">Notes: ${body.notes}</td></tr>` : ''}
            </tbody>
          </table>
          <div style="border-top:1px solid #e5e7eb;margin-top:4px;display:flex;justify-content:flex-end;align-items:center;gap:24px;padding:12px 8px 0;">
            <span style="font-size:13px;color:#6b7280;">Total</span>
            <span style="font-size:22px;font-weight:900;color:#e91e8c;">$${amount.toFixed(2)}</span>
          </div>
        </div>
        <div style="background:#1e3a8a;height:4px;width:100%;margin-top:40px;"></div>
        <div style="padding:16px 40px;font-size:11px;color:#6b7280;">
          Please remit payment by <strong>${dueDateStr}</strong> (${body.paymentTerms || 'Net 30'}). The invoice PDF is attached for your records. Thank you for your business.
        </div>
      </div>`;

    try {
      await this.mail.sendWithAttachments(body.recipientEmail, `Invoice #${invoiceNumber} — ${load.loadNumber ?? `Load #${load.id}`}`, html, attachments);
    } catch (e: any) {
      throw new InternalServerErrorException(e.message ?? 'Failed to send invoice email');
    }

    // Update load record
    await this.prisma.freightLoad.update({
      where: { id: loadId },
      data: {
        invoiceNumber,
        invoiceAmount: amount,
        invoiceDate: today,
        invoiceSentAt: today,
        invoiceRecipients: body.recipientEmail,
        invoiceNotes: body.notes || null,
        paymentTerms: body.paymentTerms || 'Net 30',
        paymentDueDate: dueDate,
        billingStatus: 'sent',
        billingCompany: body.billingCompany || null,
        billingContact: body.billingContact || null,
        billingEmail: body.recipientEmail,
        billingPhone: body.billingPhone || null,
        status: 'invoiced',
      },
    });

    return { invoiceNumber, amount, dueDate, sentTo: body.recipientEmail };
  }

  // ── Driver: load expenses ────────────────────────────────

  async getLoadExpenses(freightDriverId: number, loadId: number) {
    const load = await this.prisma.freightLoad.findUnique({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');
    return this.prisma.freightLoadExpense.findMany({
      where: { loadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addLoadExpense(freightDriverId: number, loadId: number, description: string, amount: number) {
    const load = await this.prisma.freightLoad.findUnique({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Load not found');
    if (load.driverId !== freightDriverId) throw new ForbiddenException('Access denied');
    return this.prisma.freightLoadExpense.create({
      data: { loadId, freightDriverId, description, amount },
    });
  }

  async deleteLoadExpense(freightDriverId: number, loadId: number, expenseId: number) {
    const expense = await this.prisma.freightLoadExpense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.freightDriverId !== freightDriverId || expense.loadId !== loadId) throw new ForbiddenException('Access denied');
    return this.prisma.freightLoadExpense.delete({ where: { id: expenseId } });
  }

  // ── Freight Driver Disputes ──────────────────────────────

  async getFreightDriverDisputes(freightDriverId: number) {
    return this.prisma.freightDriverDispute.findMany({
      where: { freightDriverId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createFreightDriverDispute(freightDriverId: number, body: { subject: string; message: string }) {
    const driver = await this.prisma.freightDriver.findUnique({
      where: { id: freightDriverId }, select: { name: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    const dispute = await this.prisma.freightDriverDispute.create({
      data: {
        freightDriverId,
        subject: body.subject,
        messages: {
          create: {
            senderRole: 'driver',
            senderName: driver.name,
            content: body.message,
          },
        },
      },
      include: { messages: true },
    });
    return dispute;
  }

  async sendFreightDisputeMessage(freightDriverId: number, disputeId: number, content: string) {
    const dispute = await this.prisma.freightDriverDispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.freightDriverId !== freightDriverId) throw new ForbiddenException('Access denied');
    const driver = await this.prisma.freightDriver.findUnique({
      where: { id: freightDriverId }, select: { name: true },
    });
    const msg = await this.prisma.freightDisputeMessage.create({
      data: { disputeId, senderRole: 'driver', senderName: driver!.name, content },
    });
    await this.prisma.freightDriverDispute.update({
      where: { id: disputeId }, data: { updatedAt: new Date() },
    });
    return msg;
  }

  // ── Admin: freight dispute management ───────────────────────

  async getFreightDisputes() {
    return this.prisma.freightDriverDispute.findMany({
      include: {
        driver: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateFreightDisputeStatus(disputeId: number, status: string, adminNotes?: string) {
    return this.prisma.freightDriverDispute.update({
      where: { id: disputeId },
      data: { status, adminNotes: adminNotes ?? undefined },
    });
  }

  async sendFreightDisputeAdminMessage(disputeId: number, content: string) {
    const msg = await this.prisma.freightDisputeMessage.create({
      data: { disputeId, senderRole: 'admin', senderName: 'Admin', content },
    });
    await this.prisma.freightDriverDispute.update({
      where: { id: disputeId }, data: { updatedAt: new Date() },
    });
    return msg;
  }

  // ── Freight Driver Notifications ─────────────────────────────

  async getFreightDriverNotifications(freightDriverId: number) {
    return this.prisma.freightDriverNotification.findMany({
      where: { freightDriverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markFreightNotificationRead(freightDriverId: number, notificationId: number) {
    const notif = await this.prisma.freightDriverNotification.findUnique({ where: { id: notificationId } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.freightDriverId !== freightDriverId) throw new ForbiddenException('Access denied');
    return this.prisma.freightDriverNotification.update({
      where: { id: notificationId }, data: { isRead: true },
    });
  }

  async markAllFreightNotificationsRead(freightDriverId: number) {
    await this.prisma.freightDriverNotification.updateMany({
      where: { freightDriverId, isRead: false }, data: { isRead: true },
    });
    return { success: true };
  }

  async sendFreightDriverNotification(freightDriverId: number, title: string, body: string, type = 'general') {
    return this.prisma.freightDriverNotification.create({
      data: { freightDriverId, title, body, type },
    });
  }

  // ── Admin: Driver Payroll ────────────────────────────────

  async getFreightPayroll() {
    const loads = await this.prisma.freightLoad.findMany({
      where: {
        driverPay: { not: null },
        driverId: { not: null },
      },
      select: {
        id: true, loadNumber: true, status: true,
        driverPay: true, driverPayStatus: true, driverPaidAt: true,
        pickupCity: true, deliveryCity: true, pickupDate: true,
        driver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const paid    = loads.filter(l => l.driverPayStatus === 'paid');
    const pending = loads.filter(l => l.driverPayStatus !== 'paid');

    return {
      loads,
      summary: {
        totalLoads: loads.length,
        totalPaid:    paid.reduce((s, l) => s + (l.driverPay ?? 0), 0),
        totalPending: pending.reduce((s, l) => s + (l.driverPay ?? 0), 0),
      },
    };
  }

  async setDriverPayStatus(loadId: number, status: 'paid' | 'pending') {
    return this.prisma.freightLoad.update({
      where: { id: loadId },
      data: {
        driverPayStatus: status === 'paid' ? 'paid' : null,
        driverPaidAt:    status === 'paid' ? new Date() : null,
      },
    });
  }
}
