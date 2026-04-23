/**
 * Sistema de planos: define quais features cada plano libera.
 *
 * Uso:
 *   if (hasFeature(company.plan, 'webhook_response')) { ... }
 *
 * Para adicionar uma nova feature:
 *   1. Adicione o nome no tipo `Feature`
 *   2. Inclua no array do plano correspondente em PLAN_FEATURES
 *   3. Use `hasFeature` na rota/menu/componente que controla o acesso
 */

export type Plan = 'lite' | 'premium' | 'elite'

export type Feature =
  // Lite (todas as empresas)
  | 'regua_basica'
  | 'dashboard'
  | 'sync_erp'
  | 'relatorio_diario'
  | 'export_csv'
  // Premium
  | 'webhook_response'
  | 'segunda_via_on_demand'
  | 'suspensao_automatica'
  | 'multi_instance_whatsapp'
  // Elite
  | 'parcelamento_whatsapp'
  | 'regua_personalizavel'
  | 'ia_preditiva'
  | 'chatbot_faq'

export const PLAN_LABELS: Record<Plan, string> = {
  lite: 'Lite',
  premium: 'Premium',
  elite: 'Elite',
}

export const PLAN_FEATURES: Record<Plan, Feature[]> = {
  lite: ['regua_basica', 'dashboard', 'sync_erp', 'relatorio_diario', 'export_csv'],
  premium: [
    // Lite +
    'regua_basica', 'dashboard', 'sync_erp', 'relatorio_diario', 'export_csv',
    'webhook_response', 'segunda_via_on_demand', 'suspensao_automatica', 'multi_instance_whatsapp',
  ],
  elite: [
    // Premium +
    'regua_basica', 'dashboard', 'sync_erp', 'relatorio_diario', 'export_csv',
    'webhook_response', 'segunda_via_on_demand', 'suspensao_automatica', 'multi_instance_whatsapp',
    'parcelamento_whatsapp', 'regua_personalizavel', 'ia_preditiva', 'chatbot_faq',
  ],
}

export function hasFeature(plan: string | null | undefined, feature: Feature): boolean {
  const normalized = (plan || 'lite') as Plan
  const features = PLAN_FEATURES[normalized] || PLAN_FEATURES.lite
  return features.includes(feature)
}

export function requiredPlanFor(feature: Feature): Plan {
  if (PLAN_FEATURES.lite.includes(feature)) return 'lite'
  if (PLAN_FEATURES.premium.includes(feature)) return 'premium'
  return 'elite'
}
