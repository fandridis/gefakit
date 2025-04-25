import { useFieldContext } from '../form-context'
import { Input } from '@/components/ui/input'
export default function TextInput(props: React.ComponentProps<typeof Input>) {
    const field = useFieldContext<string>()

    return (
        <Input
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
