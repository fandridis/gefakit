import { useStore } from '@tanstack/react-form'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useFieldContext } from '../form-context'

export default function FieldLabel({ label }: { label?: string }) {
    const field = useFieldContext<string>();

    const firstFormError = useStore(field.form.store, (formState) => formState.errors[0]?.[field.name]?.[0])

    const isTouched = field.state.meta.isTouched;
    const hasAttemptedSubmit = field.form.state.submissionAttempts > 0;

    const shouldShowError = (isTouched || hasAttemptedSubmit) && firstFormError

    return (
        <Label
            className={cn(
                "mb-0.5 text-sm",
                shouldShowError && 'text-destructive'
            )}
            htmlFor={field.name}
        >
            {label || field.name}
        </Label>
    )
}
