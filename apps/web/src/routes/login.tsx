import { createFileRoute, redirect, useRouter, useRouterState } from '@tanstack/react-router'
import { z } from 'zod'

import { LoginForm } from '@/features/auth/components/login-form'
import { GalleryVerticalEnd } from 'lucide-react'
import { sessionQueryKey, useAuth } from '@/features/auth/hooks/useAuth'
import { externalAuthStore } from '@/lib/use-external-auth'
import { useEffect } from 'react'

const fallback = '/dashboard' as const

export const Route = createFileRoute('/login')({
    validateSearch: z.object({
        redirect: z.string().optional().catch(''),
    }),
    beforeLoad: ({ context, search }) => {
        console.log('[login.tsx][beforeLoad] context', context)
        if (context.authState.session) {
            console.log('User is authenticated, redirecting to: ', search.redirect || fallback)
            throw redirect({ to: search.redirect || fallback, replace: true })
        }
    },
    shouldReload: ({ context }) => {
        console.log('[login.tsx][shouldReload] context', context)
        // return 
    },
    component: LoginComponent,
})

function LoginComponent() {
    console.log('Rendering LoginComponent')
    const isLoading = useRouterState({ select: (s) => s.isLoading })
    const navigate = Route.useNavigate()
    const search = Route.useSearch()
    const context = Route.useRouteContext()
    const auth = useAuth();

    useEffect(() => {
        if (auth.session) {
            console.log('Setting external session')
            externalAuthStore.setSession(auth.session.session)
            externalAuthStore.setUser(auth.session.user)
            navigate({ to: search.redirect || fallback })
        }
    }, [auth.session])


    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a href="#" className="flex items-center gap-2 self-center font-medium">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <GalleryVerticalEnd className="size-4" />
                    </div>
                    GefaKit
                </a>
                <LoginForm loading={isLoading} />
            </div>
        </div>
    )
}