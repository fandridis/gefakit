import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { sessionQueryKey } from "../hooks/use-auth"
import { useAppForm } from "@/components/form/form"
import { signUpEmailRequestBodySchema } from "@gefakit/shared/src/schemas/auth.schema"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { z } from "zod";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiSignUpEmail } from '../api';
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { MailCheck } from "lucide-react"


type RegisterFormValues = z.infer<typeof signUpEmailRequestBodySchema>;

export function RegisterForm() {
    const queryClient = useQueryClient();
    const [hasSubmittedSuccessfully, setHasSubmittedSuccessfully] = useState(false);

    const mutation = useMutation({
        mutationFn: apiSignUpEmail,
        onSuccess: () => {
            setHasSubmittedSuccessfully(true);
            return queryClient.invalidateQueries({ queryKey: sessionQueryKey });
        },
    });

    const form = useAppForm({
        defaultValues: {
            username: "",
            email: "",
            password: "",
        } as RegisterFormValues,
        validators: {
            onBlur: signUpEmailRequestBodySchema,
        },
        onSubmit: async ({ value }) => {
            mutation.mutate(value);
        }
    })

    if (hasSubmittedSuccessfully) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <MailCheck className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="mt-4 text-2xl">Registration Successful!</CardTitle>
                    <CardDescription>
                        Please check your email inbox to verify your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground">
                        Didn't receive an email? Check your spam folder or <button className="underline underline-offset-4 hover:text-primary">resend verification email</button>.
                    </p>
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
                    <CardTitle className="text-xl">Create an account</CardTitle>
                    <CardDescription>
                        Sign up with your Google or Github account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {mutation.error && (
                        <Alert className="mb-4" variant="destructive">
                            <AlertCircle className="6-4 w-6" />
                            <AlertTitle>Error!</AlertTitle>
                            <AlertDescription>{mutation.error.message || 'An unexpected error occurred during registration.'}</AlertDescription>
                        </Alert>
                    )}
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}>
                        <div className="grid gap-6">
                            <div className="flex flex-col gap-4">
                                <Button variant="outline" className="w-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                        <path
                                            d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                                            fill="currentColor"
                                        />
                                    </svg>
                                    Sign up with Github
                                </Button>
                                <Button variant="outline" className="w-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                        <path
                                            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                    Sign up with Google
                                </Button>
                            </div>
                            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                                    Or sign up with email
                                </span>
                            </div>
                            <div className="grid gap-6">
                                <form.AppForm>
                                    <form.AppField
                                        name="username"
                                        children={(field) => (
                                            <div className="grid gap-2">
                                                <field.Label label="Username" />
                                                <field.TextInput type="text" placeholder="yourusername" required />
                                                <field.Info />
                                            </div>
                                        )}
                                    />
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
                                    <form.AppField
                                        name="password"
                                        children={(field) => (
                                            <div className="grid gap-2">
                                                <field.Label label="Password" />
                                                <field.TextInput type="password" required />
                                                <field.Info />
                                            </div>
                                        )}
                                    />
                                    <form.SubmitButton label="Sign Up" loading={mutation.isPending} />
                                </form.AppForm>
                            </div>
                            <div className="text-center text-sm">
                                Already have an account?{" "}
                                <Link to='/login' className="underline underline-offset-4">
                                    Login
                                </Link>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
            <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary  ">
                By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
                and <a href="#">Privacy Policy</a>.
            </div>
        </div>
    )
}
