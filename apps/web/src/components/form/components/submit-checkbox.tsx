import { Checkbox } from "@/components/ui/checkbox"
import { useFormContext } from "../form-context"

interface SubmitCheckboxProps {
    label?: string;
    loading?: boolean;
    disabled?: boolean;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export default function SubmitCheckbox({ label, loading, disabled, checked, onCheckedChange }: SubmitCheckboxProps) {
    const form = useFormContext()

    return (
        <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
                <div className="flex items-center space-x-2">
                    <Checkbox
                        type="submit"
                        disabled={isSubmitting || loading || disabled}
                        id="submit-checkbox"
                        checked={checked}
                        onCheckedChange={onCheckedChange}
                    />
                    {label && <label htmlFor="submit-checkbox">{label}</label>}
                </div>
            )}
        </form.Subscribe>
    )
}
