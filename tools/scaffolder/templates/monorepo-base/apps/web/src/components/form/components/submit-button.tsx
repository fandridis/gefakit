import { Button } from "@/components/ui/button"
import { useFormContext } from "../form-context"

export default function SubmitButton({ label, loading, disabled }: { label: string, loading?: boolean, disabled?: boolean }) {
    const form = useFormContext()

    return (
        <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) =>
                <Button type="submit" disabled={isSubmitting || loading || disabled}>{label}</Button>}
        </form.Subscribe>
    )
}
