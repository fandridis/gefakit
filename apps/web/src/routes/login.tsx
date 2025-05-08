import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginForm } from '@/features/auth/components/login-form'
import { GalleryVerticalEnd } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useEffect } from 'react'
import { GetSessionResponseDTO } from '@gefakit/shared'
import { sessionQueryKey } from '@/features/auth/hooks/use-auth'

const fallback = '/' as const

export const Route = createFileRoute('/login')({
    validateSearch: z.object({
        redirect: z.string().optional().catch(''),
    }),
    beforeLoad: ({ preload, context, search }) => {
        if (preload) {
            // If we're preloading, we don't need to do anything
            return;
        }

        const queryClient = context.queryClient
        const session = queryClient.getQueryData<GetSessionResponseDTO>(sessionQueryKey)

        if (session) {
            throw redirect({ to: search.redirect || fallback, replace: true })
        }

    },
    component: LoginComponent,
})

function LoginComponent() {
    const navigate = Route.useNavigate()
    const search = Route.useSearch()
    const auth = useAuth();

    useEffect(() => {
        if (auth.isSessionSuccess && auth.session) {
            // If we reach this point and there is a session, it means it's after a successful sign-in.
            // Because if we end up on this route while authenticated, the "beforeLoad" hook would have caught it.
            // So we can safely navigate to the redirected route or default home.
            navigate({ to: search.redirect || fallback })
        }
    }, [auth.session, auth.isSessionSuccess])

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a href="#" className="flex items-center gap-2 self-center font-medium">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <GalleryVerticalEnd className="size-4" />
                    </div>
                    GefaKit 4
                </a>
                <LoginForm />
            </div>
        </div>
    )
}