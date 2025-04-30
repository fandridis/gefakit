import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { z } from "zod";
import { useMutation } from '@tanstack/react-query';
import { apiResetPassword } from '../api';
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { MailCheck } from "lucide-react"
import { useAppForm } from "@/components/form/form";


// Define Zod schema for the reset password form
const resetPasswordFormSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], // Set the error path to confirmPassword field
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

interface ResetPasswordFormProps {
    token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
    const [showSuccess, setShowSuccess] = useState(false);

    // Setup useAppForm
    const form = useAppForm({
        defaultValues: {
            password: "",
            confirmPassword: "",
        } as ResetPasswordFormValues, // Ensure type casting if needed
        validators: {
            // Example: Apply validation on blur or change
            onChange: resetPasswordFormSchema,
            // onBlur: resetPasswordFormSchema, // Or use onBlur
        },
        onSubmit: async ({ value }) => {
            console.log("Submitting password reset:", value);
            // Pass the validated data to the mutation
            resetPasswordMutation.mutate(value);
        }
    })

    // Setup mutation for resetting password
    const resetPasswordMutation = useMutation({
        // Mutation function now receives the validated form values directly
        mutationFn: (data: ResetPasswordFormValues) => apiResetPassword(token, data.password),
        onSuccess: () => {
            console.log("Password reset success");
            setShowSuccess(true); // Show success state
            form.reset(); // Reset form fields using Tanstack Form's method
        },
        onError: (error) => {
            console.error("Password reset failed:", error);
            // Remove setError call, rely on mutation.isError for display
            // form.setError('root.serverError', error.message || "Failed to reset password.");
        },
    });

    if (showSuccess) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <MailCheck className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="mt-4 text-2xl">Password Reset Successful!</CardTitle>
                    <CardDescription>
                        Your password has been updated. You can now log in with your new password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Button asChild className="mt-6 w-full">
                        <Link to="/login">Proceed to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!token) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
                    <CardTitle className="mt-4 text-2xl">Invalid Link</CardTitle>
                    <CardDescription>
                        The password reset link is missing or invalid. Please request a new one.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Button asChild className="mt-6 w-full">
                        <Link to="/request-password-reset">Request New Link</Link>
                    </Button>
                    <Button asChild variant="outline" className="mt-2 w-full">
                        <Link to="/login">Go to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">Reset Your Password</CardTitle>
                <CardDescription>
                    Enter your new password below. Make sure it's secure.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}>
                    <form.AppForm>
                        <div className="space-y-4">
                            {resetPasswordMutation.isError && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Reset Failed!</AlertTitle>
                                    <AlertDescription>
                                        {resetPasswordMutation.error?.message || 'An unexpected error occurred. Please try again.'}

                                        <Link to="/request-password-reset" className="underline">
                                            Request new
                                        </Link>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <form.AppField
                                name="password"
                                children={(field) => (
                                    <div className="grid gap-1.5">
                                        <field.Label label="New Password" />
                                        <field.TextInput type="password" placeholder="********" required />
                                        <field.Info />
                                    </div>
                                )}
                            />
                            <form.AppField
                                name="confirmPassword"
                                children={(field) => (
                                    <div className="grid gap-1.5">
                                        <field.Label label="Confirm New Password" />
                                        <field.TextInput type="password" placeholder="********" required />
                                        <field.Info />
                                    </div>
                                )}
                            />
                            <form.SubmitButton label="Reset Password" loading={resetPasswordMutation.isPending} />
                        </div>
                    </form.AppForm>
                </form>
                <div className="mt-4 text-center text-sm">
                    Remembered your password?{" "}
                    <Link to="/login" className="underline">
                        Log in
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
