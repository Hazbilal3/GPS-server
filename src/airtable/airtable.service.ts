// src/auth/auth.service.ts
import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class AirtableService {

  constructor(
  ) {
  }

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
      return data.records.map((record) => record.fields);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch drivers from Airtable');
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
      throw new InternalServerErrorException('Failed to fetch payrolls from Airtable');
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
      throw new InternalServerErrorException('Failed to fetch payrolls from Airtable');
    }
  }

    async Routes() {
    try {
      const response = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Routes`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          },
        },
      );
      const data = await response.json();
      return data.records.map((record) => record.fields);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch routes from Airtable');
    }
  }

}
