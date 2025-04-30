import { createFileRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { GalleryVerticalEnd } from 'lucide-react'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'

export const Route = createFileRoute('/reset-password')({
    validateSearch: z.object({
        token: z.string(),
    }),
    component: ResetPasswordComponent,
})

function ResetPasswordComponent() {
    const { token } = useSearch({ from: Route.id });

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a href="#" className="flex items-center gap-2 self-center font-medium">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <GalleryVerticalEnd className="size-4" />
                    </div>
                    GefaKit
                </a>
                <ResetPasswordForm token={token} />
            </div>
        </div>
    )
}