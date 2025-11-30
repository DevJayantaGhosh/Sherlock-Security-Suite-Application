// src/store/memoryStore.ts
import { Project, AppUser } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

// in-memory arrays
export const projects: Project[] = [];
export const users: AppUser[] = [];

export function seed() {
  if (users.length) return;

  const admin = { id: uuidv4(), name: 'Alice Admin', email: 'alice@org', role: 'Admin', releaseProjectIds: [] };
  const pd = { id: uuidv4(), name: 'Peter PD', email: 'peter@org', role: 'ProjectDirector', releaseProjectIds: [] };
  const sh = { id: uuidv4(), name: 'Sasha SH', email: 'sasha@org', role: 'SecurityHead', releaseProjectIds: [] };
  const re1 = { id: uuidv4(), name: 'Eddie RE', email: 'eddie@org', role: 'ReleaseEngineer', releaseProjectIds: [] };
  users.push(admin, pd, sh, re1);

  const p1: Project = {
    id: uuidv4(),
    name: 'Project Alpha',
    description: 'Alpha project demo',
    teamLead: 'John',
    projectDirectorId: pd.id,
    securityHeadId: sh.id,
    releaseEngineersIds: [re1.id],
    gitRepo: 'https://github.com/org/alpha',
    gpgKey: 'ABC123',
    dependencies: ['lodash', 'react'],
    createdAt: new Date().toISOString(),
    status: 'Pending',
  };

  projects.push(p1);
}
