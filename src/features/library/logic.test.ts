// The view logic, fed with a small made-up library (a feature test may not import core adapters).
import { describe, expect, it } from '@jest/globals';

import type { Card, ChangeRequest, Item, LibraryData } from '../../contracts/library';
import { myDepartments, myPending, toReview } from './logic';

const ME = 'me';
const COLLEAGUE = 'colleague';

function item(id: string, name: string, shelf: string, synonyms: string[] = []): Item {
  return { id, department_id: 'd-cvor', name, category: 'Supply', shelf, sub_location: null, synonyms, notes: null, photo_path: null, version: 1 };
}

function card(id: string, surgeon: string, procedure: string, specialty: string): Card {
  return { id, department_id: 'd-cvor', surgeon, procedure, specialty, notes: null, version: 1 };
}

function request(id: string, proposedBy: string, createdAt: string, change: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id, department_id: 'd-cvor', proposed_by: proposedBy, kind: 'edit', target: 'item', target_id: 'i-prolene',
    data: {}, base_version: 1, status: 'pending', created_at: createdAt, ...change,
  };
}

function library(requests: ChangeRequest[] = []): LibraryData {
  return {
    hospitals: [
      { id: 'h-sample', name: 'Sample General Hospital', city: null },
      { id: 'h-heart', name: 'Demo Heart Center', city: null },
    ],
    departments: [
      { id: 'd-main', hospital_id: 'h-sample', name: 'Main OR' },
      { id: 'd-cvor', hospital_id: 'h-sample', name: 'CVOR / Cardiac OR' },
      { id: 'd-heart', hospital_id: 'h-heart', name: 'Main OR' },
    ],
    memberships: [
      { user_id: ME, department_id: 'd-cvor', job_role: 'Scrub nurse' },
      { user_id: ME, department_id: 'd-main', job_role: 'Scrub nurse' },
      { user_id: COLLEAGUE, department_id: 'd-heart', job_role: null },
    ],
    items: [
      item('i-prolene', '4-0 Prolene', 'Suture cart', ['Prolene 4-0']),
      item('i-debakey', 'DeBakey forceps', 'Core B', ['Debakeys']),
      item('i-vicryl', '0 Vicryl CT-1', 'Suture cart'),
    ],
    cards: [
      card('c-cabg', 'Dr. Patel', 'CABG x3', 'Cardiac'),
      card('c-chole', 'Dr. Kim', 'Lap chole', 'General'),
      card('c-avr', 'Dr. Okafor', 'AVR', 'Cardiac'),
    ],
    cardItems: [],
    requests,
    loadedAt: '2026-11-09T12:00:00.000Z',
  };
}

describe('view logic on a small library', () => {
  it('lists my departments with their hospital, sorted', () => {
    expect(myDepartments(library(), ME).map((m) => `${m.hospital?.name} · ${m.department.name}`)).toEqual([
      'Sample General Hospital · CVOR / Cardiac OR',
      'Sample General Hospital · Main OR',
    ]);
  });

  it("lists a colleague's pending changes to review, oldest first", () => {
    const data = library([request('r-1', COLLEAGUE, '2026-11-09T11:00:00Z'), request('r-2', COLLEAGUE, '2026-11-09T09:00:00Z')]);
    expect(toReview(data, ME).map((r) => r.id)).toEqual(['r-2', 'r-1']);
  });

  it('leaves out reviewed changes and changes in departments I am not in', () => {
    const data = library([
      request('r-1', COLLEAGUE, '2026-11-09T11:00:00Z'),
      request('r-2', COLLEAGUE, '2026-11-09T09:00:00Z', { status: 'rejected' }),
      request('r-3', COLLEAGUE, '2026-11-09T10:00:00Z', { department_id: 'd-heart' }),
    ]);
    expect(toReview(data, ME).map((r) => r.id)).toEqual(['r-1']);
  });

  it('lists my own pending changes, newest first, and not in my review list', () => {
    expect(myPending(library([request('r-1', COLLEAGUE, '2026-11-09T11:00:00Z')]), ME)).toEqual([]);
    const data = library([
      request('r-1', COLLEAGUE, '2026-11-09T11:00:00Z'),
      request('r-4', ME, '2026-11-09T08:00:00Z', { target: 'card', target_id: 'c-chole' }),
      request('r-5', ME, '2026-11-09T10:00:00Z', { target: 'card', target_id: 'c-cabg' }),
    ]);
    expect(myPending(data, ME).map((r) => r.target_id)).toEqual(['c-cabg', 'c-chole']);
    expect(toReview(data, ME).map((r) => r.id)).toEqual(['r-1']);
  });
});
