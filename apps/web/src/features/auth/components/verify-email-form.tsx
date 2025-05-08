import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { sessionQueryKey } from "../hooks/use-auth"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiResendVerificationEmail, apiVerifyEmail } from '../api';
import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { MailCheck, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input";

interface VerifyEmailFormProps {
    token: string;
}

export function VerifyEmailForm({ token }: VerifyEmailFormProps) {
    const queryClient = useQueryClient();
    const [showResendInput, setShowResendInput] = useState(false);
    const [resendEmail, setResendEmail] = useState('');
    const [showResendSuccess, setShowResendSuccess] = useState(false);

    const mutation = useMutation({
        mutationFn: apiVerifyEmail,
        onSuccess: () => {
            return queryClient.invalidateQueries({ queryKey: sessionQueryKey });
        },
    });

    const resendVerificationEmailMutation = useMutation({
        mutationFn: apiResendVerificationEmail,
        onSuccess: () => {
            console.log("Resending verification email success");
            setShowResendInput(false);
            setShowResendSuccess(true);
            setResendEmail('');
            // return queryClient.invalidateQueries({ queryKey: sessionQueryKey });
        },
        onError: () => {
            // Keep the input visible on error
            setShowResendSuccess(false);
        }
    });

    const handleResendVerificationEmail = () => {
        console.log("Showing resend input");
        setShowResendInput(true);
        setShowResendSuccess(false); // Hide success message if shown before
        // Don't trigger mutation here anymore
        // resendVerificationEmailMutation.mutate();
    }

    const handleSendResendEmail = () => {
        if (resendEmail) {
            console.log("Resending verification email for:", resendEmail);
            // TODO: Add schema validation for email if needed
            // Assuming the API expects the email string directly based on the type error
            resendVerificationEmailMutation.mutate(resendEmail);
        } else {
            // TODO: Add better error handling for empty email
            console.error("Email cannot be empty");
        }
    }

    useEffect(() => {
        console.log("Will verify email: ", token);
        if (token) {
            mutation.mutate(token);
        }
    }, [token, mutation.mutate]);

    if (mutation.isPending) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                    <CardTitle className="mt-4 text-2xl">Verifying Email...</CardTitle>
                    <CardDescription>
                        Please wait while we verify your email address.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (mutation.error) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                    <CardTitle className="mt-4 text-2xl">Verification Failed</CardTitle>
                    <CardDescription>
                        There was an issue verifying your email. It might be invalid or expired.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error!</AlertTitle>
                        <AlertDescription>{mutation.error.message || 'An unexpected error occurred during verification.'}</AlertDescription>
                    </Alert>

                    {!showResendSuccess && (
                        <div className="mt-4 flex flex-col items-center space-y-2">
                            {!showResendInput ? (
                                <Button onClick={handleResendVerificationEmail} className="underline" variant="link">
                                    Resend verification email.
                                </Button>
                            ) : (
                                <>
                                    <Input
                                        type="email"
                                        placeholder="Enter your email"
                                        value={resendEmail}
                                        onChange={(e) => setResendEmail(e.target.value)}
                                        disabled={resendVerificationEmailMutation.isPending}
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={handleSendResendEmail}
                                        disabled={!resendEmail || resendVerificationEmailMutation.isPending}
                                        className="w-full"
                                    >
                                        {resendVerificationEmailMutation.isPending ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Send new verification email.
                                    </Button>
                                </>
                            )}
                            {resendVerificationEmailMutation.isError && (
                                <Alert variant="destructive" className="w-full text-left">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Resend Error!</AlertTitle>
                                    <AlertDescription>
                                        {resendVerificationEmailMutation.error?.message || 'Failed to resend email.'}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    {showResendSuccess && (
                        <Alert variant="default" className="mt-4 w-full text-left">
                            <MailCheck className="h-4 w-4 text-green-500" />
                            <AlertTitle>Email Sent!</AlertTitle>
                            <AlertDescription>
                                If your email address is registered and not verified, a new verification link has been sent. Please check your inbox.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="mt-4 flex justify-center">
                        <Button asChild className="mt-2 w-full">
                            <Link to="/login">Go to Login</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (mutation.isSuccess) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <MailCheck className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="mt-4 text-2xl">Email Verified!</CardTitle>
                    <CardDescription>
                        Your email address has been successfully verified.
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
                    <CardTitle className="mt-4 text-2xl">Missing Token</CardTitle>
                    <CardDescription>
                        No verification token found. Please check the link you used.
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

    return null;
}
