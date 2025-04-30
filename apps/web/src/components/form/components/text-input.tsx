import { useStore } from '@tanstack/react-form';
import { useFieldContext } from '../form-context'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function TextInput(props: React.ComponentProps<typeof Input>) {
    const field = useFieldContext<string>();
    const firstFormError = useStore(field.form.store, (formState) => formState.errors[0]?.[field.name]?.[0])

    const isTouched = field.state.meta.isTouched;
    const hasAttemptedSubmit = field.form.state.submissionAttempts > 0;
    const shouldShowError = (isTouched || hasAttemptedSubmit) && firstFormError

    return (
        <Input
            className={cn(shouldShowError && 'border-destructive')}
            {...props}
            id={field.name}
            name={field.name}
            type="text"
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
        />
    )
}
