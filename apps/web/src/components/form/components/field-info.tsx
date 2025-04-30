import { useStore } from '@tanstack/react-form'
import { useFieldContext } from '../form-context'

export default function FieldInfo() {
    const field = useFieldContext<string>();
    const firstFormError = useStore(field.form.store, (formState) => formState.errors[0]?.[field.name]?.[0])

    const isTouched = field.state.meta.isTouched;
    const hasAttemptedSubmit = field.form.state.submissionAttempts > 0;
    const shouldShowError = (isTouched || hasAttemptedSubmit) && firstFormError

    return (
        <>
            {shouldShowError && (
                <div className="text-destructive text-sm">
                    {typeof firstFormError === 'string' ? firstFormError : firstFormError?.message}
                </div>
            )}
            {field.state.meta.isValidating ? 'Validating...' : null}
        </>
    )
}