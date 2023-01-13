import omit from 'lodash/omit';

import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import type FormModel from 'sentry/components/forms/model';
import type {TextAreaProps} from 'sentry/components/inputGroup';
import {InputGroup, InputTrailingItems, TextArea} from 'sentry/components/inputGroup';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

export interface TextareaFieldProps
  extends Omit<InputFieldProps, 'field'>,
    Pick<TextAreaProps, 'monospace' | 'autosize' | 'rows' | 'maxRows'> {}

function TextareaField({
  monospace,
  rows,
  autosize,
  hideControlState,
  ...props
}: TextareaFieldProps) {
  return (
    <FormField {...props} hideControlState flexibleControlStateSize>
      {({
        children: _children,
        model,
        name,
        ...fieldProps
      }: {
        children: React.ReactNode;
        model: FormModel;
        name: string;
      }) => (
        <InputGroup>
          <TextArea
            {...{monospace, rows, autosize, name}}
            // Do not forward required to `textarea` to avoid default browser behavior
            {...omit(fieldProps, ['onKeyDown', 'children', 'required'])}
          />
          {!hideControlState && (
            <InputTrailingItems>
              <FormFieldControlState model={model} name={name} />
            </InputTrailingItems>
          )}
        </InputGroup>
      )}
    </FormField>
  );
}

export default TextareaField;
