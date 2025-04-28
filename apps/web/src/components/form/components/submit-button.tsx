import { Button } from "@/components/ui/button"
import { useFormContext } from "../form-context"
import { LoadingOverlay } from "@/components/loading-overlay"

export default function SubmitButton({ label, loading, disabled }: { label: string, loading?: boolean, disabled?: boolean }) {
    const form = useFormContext()

    return (
        <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) =>
                <LoadingOverlay loading={isSubmitting || loading || false}>
                    <Button className="w-full" type="submit" disabled={isSubmitting || loading || disabled}>{label}</Button>
                </LoadingOverlay>
            }
        </form.Subscribe>
    )
}
