import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useAppForm } from "@/components/form/form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { z } from "zod";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequestResetPassword } from '../api';
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { MailCheck } from "lucide-react"

export const requestPasswordResetRequestBodySchema = z.object({
    email: z.string().email("Invalid email address"),
});

type RequestPasswordResetFormValues = z.infer<typeof requestPasswordResetRequestBodySchema>;

export function RequestPasswordResetForm() {
    const [hasSubmittedSuccessfully, setHasSubmittedSuccessfully] = useState(false);

    const mutation = useMutation({
        mutationFn: apiRequestResetPassword,
        onSuccess: () => {
            setHasSubmittedSuccessfully(true);
        },
    });

    const form = useAppForm({
        defaultValues: {
            email: "",
        } as RequestPasswordResetFormValues,
        validators: {
            onBlur: requestPasswordResetRequestBodySchema,
        },
        onSubmit: async ({ value }) => {
            mutation.mutate(value.email);
        }
    })

    if (hasSubmittedSuccessfully) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <MailCheck className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="mt-4 text-2xl">Check Your Email</CardTitle>
                    <CardDescription>
                        If an account with that email address exists, we've sent instructions
                        for resetting your password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Button asChild className="mt-6 w-full">
                        <Link to="/login">Go to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className={cn("flex flex-col gap-6")}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Reset Your Password</CardTitle>
                    <CardDescription>
                        Enter your email address below and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {mutation.error && (
                        <Alert className="mb-4" variant="destructive">
                            <AlertCircle className="6-4 w-6" />
                            <AlertTitle>Error!</AlertTitle>
                            <AlertDescription>{mutation.error.message || 'An unexpected error occurred.'}</AlertDescription>
                        </Alert>
                    )}
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}>
                        <div className="grid gap-6">
                            <div className="grid gap-6">
                                <form.AppForm>
                                    <form.AppField
                                        name="email"
                                        children={(field) => (
                                            <div className="grid gap-2">
                                                <field.Label label="Email" />
                                                <field.TextInput type="email" placeholder="m@example.com" required />
                                                <field.Info />
                                            </div>
                                        )}
                                    />
                                    <form.SubmitButton label="Send Reset Link" loading={mutation.isPending} />
                                </form.AppForm>
                            </div>
                            <div className="text-center text-sm">
                                Remembered your password?{" "}
                                <Link to='/login' className="underline underline-offset-4">
                                    Login
                                </Link>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
