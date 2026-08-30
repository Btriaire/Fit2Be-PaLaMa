// Programmes coaching Endurance créés par l'utilisateur — même forme que les
// programmes intégrés (endurancePrograms.ts) pour pouvoir traverser tel quel
// le même moteur de chrono live (getPhaseAt, IntervalProfile...), juste
// stockés à part pour ne jamais être confondus avec le catalogue proposé.

import { getDb, newId } from './db'
import { pushRecord, deleteRecord } from './cloudSync'
import type { EnduranceProgram } from './endurancePrograms'

export interface CustomEnduranceProgram extends EnduranceProgram {
  createdAt: number
}

export async function getCustomEndurancePrograms(): Promise<CustomEnduranceProgram[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('customEndurancePrograms', 'byCreatedAt')
  return all.reverse()
}

/** Crée ou met à jour (si `input.id` correspond à un programme existant) un
 * programme personnalisé. */
export async function saveCustomEnduranceProgram(
  input: Omit<EnduranceProgram, 'id'> & { id?: string },
): Promise<CustomEnduranceProgram> {
  const db = await getDb()
  const existing = input.id ? await db.get('customEndurancePrograms', input.id) : undefined
  const program: CustomEnduranceProgram = {
    ...input,
    id: input.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
  }
  await db.put('customEndurancePrograms', program)
  pushRecord('customEndurancePrograms', program.id, program)
  return program
}

export async function deleteCustomEnduranceProgram(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('customEndurancePrograms', id)
  deleteRecord('customEndurancePrograms', id)
}
