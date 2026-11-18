import { useState, type ChangeEvent, type SyntheticEvent } from 'react';
import {
  SESSION_LABELS,
  SESSIONS,
  STEP_LABELS,
  STEPS,
  type FieldError,
  type ProductInput,
  type Session,
  type Step,
} from './products';

export type SubmitResult = { ok: true } | { ok: false; fieldErrors: FieldError[]; message: string };

export interface ProductFormProps {
  onSubmit: (input: ProductInput) => Promise<SubmitResult>;
}

/** Mirrors the contract's `name`/`brand` bound (`maxLength` 80). */
const MAX_TEXT_LENGTH = 80;
const NAME_REQUIRED = 'Name is required.';
const BRAND_REQUIRED = 'Brand is required.';
const STEP_REQUIRED = 'Step is required.';
const SESSION_REQUIRED = 'Session is required.';
const NAME_TOO_LONG = `Name must be at most ${String(MAX_TEXT_LENGTH)} characters.`;
const BRAND_TOO_LONG = `Brand must be at most ${String(MAX_TEXT_LENGTH)} characters.`;

export function ProductForm({ onSubmit }: ProductFormProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [step, setStep] = useState<Step | ''>('');
  const [session, setSession] = useState<Session | ''>('');
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: FieldError['field']): FieldError | undefined =>
    fieldErrors.find((error) => error.field === field);

  const submit = async (input: ProductInput): Promise<void> => {
    setSubmitting(true);
    try {
      const result = await onSubmit(input);
      if (result.ok) {
        setName('');
        setBrand('');
        setStep('');
        setSession('');
      } else {
        setFieldErrors(result.fieldErrors);
        setFormError(result.message);
      }
    } catch {
      setFormError('The product could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (submitting) return;
    setFormError('');

    const trimmedName = name.trim();
    const trimmedBrand = brand.trim();
    const errors: FieldError[] = [];
    if (trimmedName.length === 0) {
      errors.push({ field: 'name', message: NAME_REQUIRED });
    } else if (trimmedName.length > MAX_TEXT_LENGTH) {
      errors.push({ field: 'name', message: NAME_TOO_LONG });
    }
    if (trimmedBrand.length === 0) {
      errors.push({ field: 'brand', message: BRAND_REQUIRED });
    } else if (trimmedBrand.length > MAX_TEXT_LENGTH) {
      errors.push({ field: 'brand', message: BRAND_TOO_LONG });
    }
    if (step === '') errors.push({ field: 'step', message: STEP_REQUIRED });
    if (session === '') errors.push({ field: 'session', message: SESSION_REQUIRED });

    if (errors.length > 0 || step === '' || session === '') {
      setFieldErrors(errors);
      setFormError('Please correct the highlighted fields.');
      return;
    }

    setFieldErrors([]);
    void submit({ name: trimmedName, brand: trimmedBrand, step, session });
  };

  const nameError = errorFor('name');
  const brandError = errorFor('brand');
  const stepError = errorFor('step');
  const sessionError = errorFor('session');

  return (
    <form className="product-form" onSubmit={handleSubmit} noValidate>
      <p className="form-error" role="alert">
        {formError}
      </p>
      <p className="field">
        <label htmlFor="product-name">Name</label>
        <input
          id="product-name"
          name="name"
          type="text"
          value={name}
          required
          aria-invalid={nameError !== undefined}
          aria-describedby={nameError ? 'name-error' : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setName(event.target.value);
          }}
        />
        <span className="field-error" id="name-error">
          {nameError?.message ?? ''}
        </span>
      </p>
      <p className="field">
        <label htmlFor="product-brand">Brand</label>
        <input
          id="product-brand"
          name="brand"
          type="text"
          value={brand}
          required
          aria-invalid={brandError !== undefined}
          aria-describedby={brandError ? 'brand-error' : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setBrand(event.target.value);
          }}
        />
        <span className="field-error" id="brand-error">
          {brandError?.message ?? ''}
        </span>
      </p>
      <p className="field">
        <label htmlFor="product-step">Step</label>
        <select
          id="product-step"
          name="step"
          value={step}
          required
          aria-invalid={stepError !== undefined}
          aria-describedby={stepError ? 'step-error' : undefined}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setStep(event.target.value as Step | '');
          }}
        >
          <option value="">Select a step</option>
          {STEPS.map((value) => (
            <option key={value} value={value}>
              {STEP_LABELS[value]}
            </option>
          ))}
        </select>
        <span className="field-error" id="step-error">
          {stepError?.message ?? ''}
        </span>
      </p>
      <fieldset
        className="field session-field"
        aria-describedby={sessionError ? 'session-error' : undefined}
      >
        <legend>Session</legend>
        {SESSIONS.map((value) => (
          <span className="session-option" key={value}>
            <input
              id={`product-session-${value}`}
              name="session"
              type="radio"
              value={value}
              checked={session === value}
              onChange={() => {
                setSession(value);
              }}
            />
            <label htmlFor={`product-session-${value}`}>{SESSION_LABELS[value]}</label>
          </span>
        ))}
        <span className="field-error" id="session-error">
          {sessionError?.message ?? ''}
        </span>
      </fieldset>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add product to routine'}
      </button>
    </form>
  );
}
