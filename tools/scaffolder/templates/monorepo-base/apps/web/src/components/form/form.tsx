import { createFormHook } from '@tanstack/react-form'
import { fieldContext, formContext } from "./form-context";
import FieldLabel from './components/field-label';
import FieldInfo from './components/field-info';
import TextInput from './components/text-input';
import SubmitButton from './components/submit-button';
import SubmitCheckbox from './components/submit-checkbox';

/**
 * If form field components gets too many, we can use lazy loading
 */
// import { lazy } from 'react'
// const TextInput = lazy(() => import('./components/text-input'))

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    TextInput,
    Label: FieldLabel,
    Info: FieldInfo,
  },
  formComponents: {
    SubmitButton,
    SubmitCheckbox,
  },
  fieldContext,
  formContext,
})
