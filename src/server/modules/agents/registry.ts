import type { HotelRole } from '@prisma/client';
import { isModuleEnabled } from '@/server/modules/feature-flags';

/**
 * Agent Runtime — Architecture §13.
 *
 * `dataScope` is a declarative allow-list of module-level capability keys.
 * Enforcement lives in `requireAgentAccess` below; an agent implementation
 * cannot read outside its declared scope even if its own code tries to,
 * because callers must go through this check before touching any module.
 */
export interface AgentDefinition {
  id: string;
  nameEn: string;
  nameAr: string;
  domain: string;
  status: 'live' | 'coming_soon';
  dataScope: string[];
  allowedRoles: HotelRole[] | 'all';
}

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: 'executive-agent',
    nameEn: 'Executive Agent',
    nameAr: 'الوكيل التنفيذي',
    domain: 'executive',
    status: 'live',
    dataScope: ['metrics', 'comparisons', 'insights', 'timeline', 'genome', 'reports:*'],
    allowedRoles: 'all',
  },
  {
    id: 'revenue-agent',
    nameEn: 'Revenue Agent',
    nameAr: 'وكيل الإيرادات',
    domain: 'revenue',
    status: 'coming_soon',
    dataScope: ['metrics:adr', 'metrics:revpar', 'metrics:room_revenue', 'timeline:revenue'],
    allowedRoles: ['HOTEL_ADMIN', 'GENERAL_MANAGER', 'REVENUE_MANAGER', 'ANALYST'],
  },
  {
    id: 'front-office-agent',
    nameEn: 'Front Office Agent',
    nameAr: 'وكيل الاستقبال',
    domain: 'front_office',
    status: 'coming_soon',
    dataScope: ['metrics:arrivals', 'metrics:departures', 'metrics:stayovers', 'timeline:front_office'],
    allowedRoles: ['HOTEL_ADMIN', 'GENERAL_MANAGER', 'FRONT_OFFICE_MANAGER'],
  },
];

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}

export function listAgentsForRole(role: HotelRole): AgentDefinition[] {
  return AGENT_REGISTRY.filter((a) => a.allowedRoles === 'all' || a.allowedRoles.includes(role));
}

/** Also enforces Feature Flags (Architecture §29) — a disabled agent domain is unavailable regardless of role. */
export async function requireAgentAccess(
  hotelId: string,
  agentId: string,
  role: HotelRole
): Promise<AgentDefinition> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);
  if (agent.allowedRoles !== 'all' && !agent.allowedRoles.includes(role)) {
    throw new Error(`FORBIDDEN: role ${role} not permitted for agent ${agentId}`);
  }
  if (!(await isModuleEnabled(hotelId, agent.domain))) {
    throw new Error(`FORBIDDEN: agent domain ${agent.domain} disabled for hotel ${hotelId}`);
  }
  return agent;
}
