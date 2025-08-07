import { Injectable } from '@nestjs/common';
import * as stringSimilarity from 'string-similarity';

@Injectable()
export class MatchService {
  compareAddresses(expected: string, actual: string): { score: number, isMismatch: boolean } {
    const score = stringSimilarity.compareTwoStrings(expected.toLowerCase(), actual.toLowerCase());
    return { score, isMismatch: score < 0.6 };
  }
}
