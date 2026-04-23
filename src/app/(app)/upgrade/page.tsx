'use client'

import { useSearchParams } from 'next/navigation'
import { Lock, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Suspense } from 'react'
import { PLAN_LABELS, type Plan } from '@/lib/plans'

function UpgradeContent() {
  const params = useSearchParams()
  const requiredPlan = (params.get('plan') || 'premium') as Plan
  const featureLabel = params.get('feature') || 'Esta funcionalidade'

  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-purple-600 dark:text-purple-300" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
            <Sparkles className="w-3 h-3" />
            Plano {PLAN_LABELS[requiredPlan]}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Disponível no plano {PLAN_LABELS[requiredPlan]}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {featureLabel} faz parte do plano {PLAN_LABELS[requiredPlan]}.
            Fale com seu consultor para liberar este recurso na sua conta.
          </p>
          <a
            href="https://wa.me/5537998558119"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition"
          >
            Falar com consultor
          </a>
        </CardContent>
      </Card>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Carregando...</div>}>
      <UpgradeContent />
    </Suspense>
  )
}
