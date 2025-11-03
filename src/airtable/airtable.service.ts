// src/auth/auth.service.ts
import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Z_ASCII } from 'zlib';

@Injectable()
export class AirtableService {
  constructor(private prisma: PrismaService) {}

  
  async Drivers() {
    try {
      const response = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Drivers`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          },
        },
      );
      const data = await response.json();
      return data.records.map((record: any) => record.fields);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch drivers from Airtable',
      );
    }
  }

  async PayRollSummary() {
    try {
      const response = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Payroll Summary`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          },
        },
      );
      const data = await response.json();
      return data.records.map((record) => record.fields);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch payrolls from Airtable',
      );
    }
  }

  async PayRolls() {
    try {
      const response = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Payroll`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          },
        },
      );
      const data = await response.json();
      return data.records.map((record) => record.fields);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch payrolls from Airtable',
      );
    }
  }

  async routes() {
    try {
      const response = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/routes`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          },
        },
      );
      const data = await response.json();
      return data.records.map((record) => record.fields);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch routes from Airtable',
      );
    }
  }
  // ➕ CREATE new driver
  async addDriver(data: any) {
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const newDriver = await this.prisma.driver.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          fullName,
          Status: data.Status,
          phoneNumber: data.phoneNumber,
          email: data.email,
          OFIDNumber: data.OFIDNumber,
          salaryType: data.salaryType,
          schedule: data.schedule,
          dayoftheweek: data.dayoftheweek,
          driverAvailableToday: data.driverAvailableToday,
        },
      });
      return newDriver;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create driver');
    }
  }

  // ✏️ UPDATE existing driver
  async editDriver(id: number, data: any) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    try {
      const updated = await this.prisma.driver.update({
        where: { id },
        data: {
          firstName: data.firstName ?? driver.firstName,
          lastName: data.lastName ?? driver.lastName,
          fullName: data.fullName ?? `${data.firstName ?? driver.firstName} ${data.lastName ?? driver.lastName}`,
          Status: data.Status ?? driver.Status,
          phoneNumber: data.phoneNumber ?? driver.phoneNumber,
          email: data.email ?? driver.email,
          OFIDNumber: data.OFIDNumber ?? driver.OFIDNumber,
          salaryType: data.salaryType ?? driver.salaryType,
          schedule: data.schedule ?? driver.schedule,
          dayoftheweek: data.dayoftheweek ?? driver.dayoftheweek,
          driverAvailableToday: data.driverAvailableToday ?? driver.driverAvailableToday,
        },
      });
      return updated;
    } catch (error) {
      throw new InternalServerErrorException('Failed to update driver');
    }
  }

  // ❌ DELETE driver
  async deleteDriver(id: number) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    try {
      await this.prisma.driver.delete({ where: { id } });
      return { id, deleted: true };
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete driver');
    }
  }


  async customroutes() {
    const routes =  await this.prisma.route.createMany({
      data: [
        {
          routeNumber: '222',
          description: 'PAWCUTUCK',
          ratePerStop: 2.35,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6379'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '222 (PAWCUTUCK)',
        },
        {
          routeNumber: '215',
          description: 'MIDDLETOWN B',
          ratePerStop: 1.75,
          zone: 'zone C',
          status: 'Active',
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'No',
          zipCode: ['6457'],
          ratePerStopCompanyVehicle: 1.5,
          route: '215 (MIDDLETOWN B)',
        },
        {
          routeNumber: '102',
          description: 'BLOOMFIELD',
          ratePerStop: 1.7,
          zone: 'zone A',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6002'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '102 (BLOOMFIELD)',
        },
        {
          routeNumber: '201',
          description: 'PRESTON/JEWETT CITY',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6365'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '201 (PRESTON/JEWETT CITY)',
        },
        {
          routeNumber: '113',
          description: 'CANTON/COLLINSVILLE',
          ratePerStop: 1.7,
          zone: 'zone A',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6019'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '113 (CANTON/COLLINSVILLE)',
        },
        {
          routeNumber: '204',
          description: 'WATERFORD',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6385'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '204 (WATERFORD)',
        },
        {
          routeNumber: '114',
          description: 'BURLINGTON',
          ratePerStop: 1.7,
          zone: 'zone A',
          status: 'Active',
          baseRate: 20,
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6013'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          baseRateCompanyVehicle: 10,
          route: '114 (BURLINGTON)',
        },
        {
          routeNumber: '112',
          description: 'WINDSOR',
          ratePerStop: 1.7,
          zone: 'zone A',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6095'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '112 (WINDSOR)',
        },
        {
          routeNumber: '217',
          description: 'MERIDEN 451',
          ratePerStop: 1.75,
          status: 'Active',
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'No',
          zipCode: ['6450', '6451'],
          ratePerStopCompanyVehicle: 1.5,
          route: '217 (MERIDEN 451)',
        },
        {
          routeNumber: '208',
          description: 'MIDDLEFIELD/DURHAM/HADDAM/HIGGINUM',
          ratePerStop: 2.1,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6441', '6438', '6422', '6455'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.85,
          route: '208 (MIDDLEFIELD/DURHAM/HADDAM/HIGGINUM)',
        },
        {
          routeNumber: '214',
          description: 'NEW LONDON',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6320'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '214 (NEW LONDON)',
        },
        {
          routeNumber: '203',
          description: 'GROTON',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6340'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '203 (GROTON)',
        },
        {
          routeNumber: '216',
          description: 'CROMWELL/E. BERLIN',
          ratePerStop: 1.65,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6416', '6037'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '216 (CROMWELL/E. BERLIN)',
        },
        {
          routeNumber: '206',
          description: 'NEW BRITAIN ',
          ratePerStop: 1.5,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6050', '6051', '6052'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.35,
          route: '206 (NEW BRITAIN )',
        },
        {
          routeNumber: '202',
          description: 'STONINGTON',
          ratePerStop: 2.35,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6378'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '202 (STONINGTON)',
        },
        {
          routeNumber: '124',
          description: 'TORRINGTON',
          ratePerStop: 1.7,
          zone: 'zone A',
          status: 'Active',
          baseRate: 30,
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6790'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          baseRateCompanyVehicle: 20,
          route: '124 (TORRINGTON)',
        },
        {
          routeNumber: '711',
          description: 'W. Hartford 06107',
          ratePerStop: 1.35,
          zone: 'zone D',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6117', '6119'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.25,
          route: '711 (W. Hartford 06107)',
        },
        {
          description: 'ADHAWK',
          ratePerStop: 2,
          zone: 'zone adhawk',
          status: 'Active',
          zipCode: [],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'No',
          ratePerStopCompanyVehicle: 2,
          route: ' (ADHAWK)',
        },
        {
          routeNumber: '103',
          description: 'SIMSBURY/W. SIMSBURY',
          ratePerStop: 1.7,
          zone: 'zone A',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6070'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '103 (SIMSBURY/W. SIMSBURY)',
        },
        {
          routeNumber: '111',
          description: 'HARTFORD 06103/06105/06112/06120',
          ratePerStop: 1.5,
          zone: 'zone A',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6103', '6105', '6112', '6120'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.35,
          route: '111 (HARTFORD 06103/06105/06112/06120)',
        },
        {
          routeNumber: '213',
          description: 'LEDYARD/MASHANTUCK',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6339'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '213 (LEDYARD/MASHANTUCK)',
        },
        {
          routeNumber: '212',
          description: 'MYSTIC',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6355'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '212 (MYSTIC)',
        },
        {
          routeNumber: '218',
          description: 'E. HAMPTON/MOODUS',
          ratePerStop: 2.1,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6424', '6423'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.85,
          route: '218 (E. HAMPTON/MOODUS)',
        },
        {
          routeNumber: '211',
          description: 'NORWICH',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6360'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '211 (NORWICH)',
        },
        {
          routeNumber: '227',
          description: 'BERLIN',
          ratePerStop: 1.65,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6037'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '227 (BERLIN)',
        },
        {
          routeNumber: '207',
          description: 'MERIDEN 450',
          ratePerStop: 1.75,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6450', '6451'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '207 (MERIDEN 450)',
        },
        {
          routeNumber: '224',
          description: 'UNCASVILLE/MONTVILLE,QUAKER HILL',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6382', '6370', '6335'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '224 (UNCASVILLE/MONTVILLE,QUAKER HILL)',
        },
        {
          routeNumber: '104',
          description: 'AVON',
          ratePerStop: 1.7,
          zone: 'zone A',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6001'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '104 (AVON)',
        },
        {
          routeNumber: '101',
          description: 'W. HARTFORD 117/119',
          ratePerStop: 1.35,
          zone: 'zone A',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6117', '6119'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.25,
          route: '101 (W. HARTFORD 117/119)',
        },
        {
          routeNumber: '205A',
          description: 'MIDDLETOWN',
          ratePerStop: 1.75,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6457'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '205A (MIDDLETOWN)',
        },
        {
          routeNumber: '217',
          description: 'MERIDEN 451',
          ratePerStop: 1.75,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6450', '6451'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.5,
          route: '217 (MERIDEN 451)',
        },
        {
          routeNumber: '234',
          description: 'GALES FERRY',
          ratePerStop: 2.25,
          zone: 'zone B',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6335'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 2,
          route: '234 (GALES FERRY)',
        },
        {
          routeNumber: '100',
          description: 'STAPLES WATERFORD/N. LONDON/ GROTON',
          ratePerStop: 2.25,
          status: 'Active',
          zipCode: ['6385', '6320', '6340'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'No',
          ratePerStopCompanyVehicle: 2,
          route: '100 (STAPLES WATERFORD/N. LONDON/ GROTON)',
        },
        {
          routeNumber: '313',
          description: 'W. Hartford 06110',
          ratePerStop: 1.35,
          zone: 'zone D',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6110'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'Yes',
          ratePerStopCompanyVehicle: 1.25,
          route: '313 (W. Hartford 06110)',
        },
        {
          routeNumber: '218A',
          description: 'PORTLAND',
          ratePerStop: 1.75,
          zone: 'zone C',
          status: 'Active',
          schedule: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          zipCode: ['6480'],
          dayOfTheWeek: 'Tuesday',
          routeScheduledForToday: 'No',
          ratePerStopCompanyVehicle: 1.5,
          route: '218A (PORTLAND)',
        },
      ],
    });
    return routes;
  }


async fetchAndSavePayroll() {
  // Step 1: Fetch data from Airtable
  const records = await this.PayRolls();

  if (!Array.isArray(records) || records.length === 0) {
    console.warn("⚠️ No payroll records fetched from Airtable");
    return { message: "No payroll records found in Airtable", count: 0 };
  }

  let savedCount = 0;

  // Step 2: Save each record into the database
  for (const fields of records) {
    try {
      const driverId = Number(fields["Driver ID"]) || null;
      const driverName = fields["Driver Name"] ?? "Unknown";

      console.log(`📥 Saving payroll record for driver: ${driverName}`);

      await this.prisma.airtablePayroll.create({
        data: {
          driverId,
          payrollGeneratedOn: fields["Payroll Generated On:"]
            ? new Date(fields["Payroll Generated On:"])
            : null,
          payPeriod: fields["Pay Period"] ?? null,
          directDepositDate: fields["Direct Deposit / Paycheck"]
            ? new Date(fields["Direct Deposit / Paycheck"])
            : null,
          weekNumber: fields["Week Number"]
            ? Number(fields["Week Number"])
            : null,
          driver: Array.isArray(fields["Driver"])
            ? fields["Driver"].join(",")
            : fields["Driver"] ?? null,
          stops: Array.isArray(fields["Stops"])
            ? fields["Stops"].join(",")
            : fields["Stops"] ?? null,
          totalFromStops: Number(fields["Total from Stops"]) || 0,
          totalBonus: Number(fields["Total Bonus"]) || 0,
          totalDeductions: Number(fields["Total Deductions"]) || 0,
          netPay: Number(fields["Net Pay"]) || 0,
          driverName,
          payrollSummary: Array.isArray(fields["Payroll Summary"])
            ? fields["Payroll Summary"].join(",")
            : fields["Payroll Summary"] ?? null,
          totalStopsCompleted: Number(fields["Total Stops Completed"]) || 0,
          salaryType: Array.isArray(fields["Salary Type"])
            ? fields["Salary Type"].join(",")
            : fields["Salary Type"] ?? null,
          subtotal: Number(fields["Subtotal"]) || 0,
          created: fields["Created"]
            ? new Date(fields["Created"])
            : new Date(),
        },
      });

      console.log(`✅ Saved payroll for driver: ${driverName}`);
      savedCount++;
    } catch (error) {
      console.error(
        `❌ Error saving payroll for driver ${fields["Driver Name"] || "Unknown"}:`,
        error.message
      );
    }
  }

  console.log(`🏁 Finished saving ${savedCount} payroll records`);
  return { message: "Payrolls saved successfully", count: savedCount };
}


  

  async fetchAndSaveDrivers() {
    const data = await this.Drivers();
  
    for (const record of data) {
      const email = record["Email"];
  
      // ✅ Skip records without an email
      if (!email) {
        console.warn("Skipping record with no email:", record["Full Name"]);
        continue;
      }
  
      // ✅ Check if the driver already exists
      const existingDriver = await this.prisma.driver.findUnique({
        where: { email },
      });
  
      if (existingDriver) {
        console.log(`Driver already exists, skipping: ${email}`);
        continue;
      }
  
      // ✅ Create new driver
      await this.prisma.driver.create({
        data: {
          fullName: record["Full Name"] ?? "",
          firstName: record["First Name"] ?? "",
          lastName: record["Last Name"] ?? "",
          Status: record["Status"] ?? "",
          phoneNumber: record["Phone Number"] ?? "",
          email ,
          OFIDNumber: record["OFID Number"] ?? null,
          salaryType: record["Salary Type"] ?? "",
          schedule: { set: record["Schedule"] ?? [] }, // ✅ Correct array format
          dayoftheweek: record["Day of the Week"] ?? "",
          driverAvailableToday:
            record["Driver Available Today?"]?.toLowerCase() === "yes",
        },
      });
    }
  
    return { message: "All unique drivers saved successfully" };
  }

  async getPayrolls(){
    const data = await this.prisma.airtablePayroll.findMany();
    return data;
  }
  
  async getDrivers(){
    const data = await this.prisma.driver.findMany();
    return data;
  }
  
}
