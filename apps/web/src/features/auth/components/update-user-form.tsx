import { useAppForm } from "@/components/form/form";
import { useAuth, sessionQueryKey } from "@/features/auth/hooks/use-auth";
import { updateUserRequestBodySchema } from "@gefakit/shared/src/schemas/user.schema";
import { z } from "zod";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiUpdateUser } from '@/features/user/api';

type UpdateUserFormValues = z.infer<typeof updateUserRequestBodySchema>;

export function UpdateUserForm() {
    const auth = useAuth();
    const currentUser = auth.session?.user;
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: apiUpdateUser,
        onSuccess: (data) => {
            console.log('User updated successfully via component mutation:', data);
            // Invalidate session query to refetch updated user data
            queryClient.invalidateQueries({ queryKey: sessionQueryKey });
            // If we did this instead, the mutation would be loading until the query is refetched.
            // return queryClient.invalidateQueries({ queryKey: sessionQueryKey });
            // Here we could also show a success message.
        },
        onError: (error) => {
            console.error('Failed to update user via component mutation:', error);
        }
    })

    const form = useAppForm({
        defaultValues: {
            username: currentUser?.username ?? '',
        } as UpdateUserFormValues,
        validators: {
            onBlur: updateUserRequestBodySchema,
        },
        onSubmit: async ({ value }) => {
            mutation.mutate(value);
        },
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
        >
            <form.AppForm>
                <form.AppField
                    name='username'
                    children={(field) => (
                        <>
                            <field.Label label="Username" />
                            <field.TextInput />
                            <field.Info />
                        </>
                    )}
                />
                {/* Use mutation state for loading and error display */}
                <form.SubmitButton label="Update Username" loading={mutation.isPending} />
                {mutation.error && (
                    <p style={{ color: 'red' }}>Error: {mutation.error.message}</p>
                )}
            </form.AppForm>
        </form>
    );
}