'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  PiArrowLeftBold,
  PiArrowRightBold,
  PiBuildingsBold,
  PiCheckBold,
  PiUserBold,
} from 'react-icons/pi';
import { registerOrganization, type AuthFormState } from '@/app/actions/auth';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { SubmitButton } from '@/components/submit-button';
import { Turnstile } from '@/components/turnstile';
import {
  btn,
  cn,
  inputClassLg,
  labelClassLg,
} from '@/lib/ui';

const initial: AuthFormState = { error: null };

type StepNumber = 1 | 2;

interface StepInfo {
  num: StepNumber;
  title: string;
  shortLabel: string;
  description: string;
}

const STEPS: readonly StepInfo[] = [
  {
    num: 1,
    title: 'Your account',
    shortLabel: 'Account',
    description: "You'll use this to sign in, run classes, and manage your cohorts.",
  },
  {
    num: 2,
    title: 'Teaching space',
    shortLabel: 'Workspace',
    description: 'Name your school or academy as your students will see it.',
  },
];

export function RegisterForm() {
  const [state, action] = useActionState(registerOrganization, initial);
  const [step, setStep] = useState<StepNumber>(1);

  // Form field state (persisted across back/next navigation)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [tagline, setTagline] = useState('');

  // Validation errors per step
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // If a server error returns, automatically jump back to the relevant step
  useEffect(() => {
    if (state.error) {
      if (
        state.error.toLowerCase().includes('email') ||
        state.error.toLowerCase().includes('password') ||
        state.error.toLowerCase().includes('account')
      ) {
        setStep(1);
      } else if (
        state.error.toLowerCase().includes('space') ||
        state.error.toLowerCase().includes('organization')
      ) {
        setStep(2);
      }
    }
  }, [state.error]);

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errs.name = 'Please enter your full name (at least 2 characters).';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!password || password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext(e: React.MouseEvent) {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) {
        setClientErrors({});
        setStep(2);
      }
    }
  }

  function handleBack(e: React.MouseEvent) {
    e.preventDefault();
    setClientErrors({});
    if (step === 2) setStep(1);
  }

  const currentStepInfo = STEPS[step - 1];

  return (
    <div className="mt-6 w-full">
      {/* 2-Step Progress Stepper */}
      <nav aria-label="Onboarding Progress" className="mb-8">
        <ol className="flex items-center justify-between gap-3 sm:gap-6" role="list">
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <li key={s.num} className="flex flex-1 items-center">
                <div
                  className="flex w-full items-center gap-2.5 sm:gap-3"
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted) {
                        setClientErrors({});
                        setStep(s.num);
                      }
                    }}
                    disabled={!isCompleted}
                    className={cn(
                      'group flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-lg p-0.5',
                      isCompleted ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-200',
                        isCompleted
                          ? 'bg-signal-700 text-white group-hover:bg-signal-800'
                          : isCurrent
                            ? 'bg-signal-700 text-white ring-4 ring-signal-100 shadow-sm'
                            : 'bg-neutral-100 text-neutral-400 border border-neutral-200',
                      )}
                    >
                      {isCompleted ? (
                        <PiCheckBold className="h-3.5 w-3.5" />
                      ) : (
                        s.num
                      )}
                    </span>
                    <span className="text-xs font-semibold">
                      <span
                        className={cn(
                          'block transition-colors',
                          isCurrent
                            ? 'text-neutral-900 font-bold'
                            : isCompleted
                              ? 'text-neutral-700'
                              : 'text-neutral-400',
                        )}
                      >
                        {s.shortLabel}
                      </span>
                    </span>
                  </button>

                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 transition-colors duration-200',
                        step > s.num ? 'bg-signal-700' : 'bg-neutral-200',
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Active Step Context Headline */}
        <div className="mt-5 border-b border-neutral-100 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-signal-700">
              Step {step} of 2
            </span>
            <span className="text-xs font-medium text-neutral-400">
              {step === 1 && 'Takes ~1 minute'}
              {step === 2 && 'Final step'}
            </span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-neutral-900 sm:text-xl">
            {currentStepInfo.title}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {currentStepInfo.description}
          </p>
        </div>
      </nav>

      {/* Global Form Error Banner */}
      <FormError message={state.error} />

      <form action={action} className="space-y-6">
        {/* =========================================================================
            STEP 1: Administrator Account Credentials
            ========================================================================= */}
        <div className={cn('space-y-5', step === 1 ? 'block' : 'hidden')}>
          <div className="space-y-1.5">
            <label htmlFor="name" className={labelClassLg}>
              Your full name
            </label>
            <div className="relative">
              <input
                id="name"
                name="name"
                required={step === 1}
                autoComplete="name"
                placeholder="e.g. Amara Okafor"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (clientErrors.name) {
                    setClientErrors((prev) => ({ ...prev, name: '' }));
                  }
                }}
                className={cn(
                  inputClassLg,
                  clientErrors.name && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
                )}
              />
              <PiUserBold className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            </div>
            {clientErrors.name && (
              <p className="text-xs font-medium text-rose-600">
                {clientErrors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className={labelClassLg}>
              Work email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required={step === 1}
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (clientErrors.email) {
                  setClientErrors((prev) => ({ ...prev, email: '' }));
                }
              }}
              className={cn(
                inputClassLg,
                clientErrors.email && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
              )}
            />
            {clientErrors.email ? (
              <p className="text-xs font-medium text-rose-600">
                {clientErrors.email}
              </p>
            ) : (
              <p className="text-[13px] text-neutral-400">
                We&apos;ll send your verification code and class reminders here.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className={labelClassLg}>
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              required={step === 1}
              minLength={8}
              autoComplete="new-password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (clientErrors.password) {
                  setClientErrors((prev) => ({ ...prev, password: '' }));
                }
              }}
              showRequirement
              size="lg"
            />
            {clientErrors.password && (
              <p className="text-xs font-medium text-rose-600">
                {clientErrors.password}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleNext}
              className={cn(btn('primary', 'xl'), 'w-full gap-2 text-base font-semibold')}
            >
              Continue to workspace setup
              <PiArrowRightBold className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            STEP 2: Teaching Space & Workspace Identity
            ========================================================================= */}
        <div className={cn('space-y-6', step === 2 ? 'block' : 'hidden')}>
          <div className="space-y-1.5">
            <label htmlFor="organizationName" className={labelClassLg}>
              School or teaching space name
            </label>
            <div className="relative">
              <input
                id="organizationName"
                name="organizationName"
                required={step === 2}
                autoComplete="organization"
                placeholder="e.g. Apex Coding Academy, Al-Huda Institute"
                value={organizationName}
                onChange={(e) => {
                  setOrganizationName(e.target.value);
                  if (clientErrors.organizationName) {
                    setClientErrors((prev) => ({ ...prev, organizationName: '' }));
                  }
                }}
                className={cn(
                  inputClassLg,
                  clientErrors.organizationName && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
                )}
              />
              <PiBuildingsBold className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            </div>
            {clientErrors.organizationName ? (
              <p className="text-xs font-medium text-rose-600">
                {clientErrors.organizationName}
              </p>
            ) : (
              <p className="text-[13px] text-neutral-400">
                This appears on your certificates, invitations, and class banners. You can edit it anytime.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tagline" className={labelClassLg}>
              Short tagline or mission{' '}
              <span className="text-xs font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="tagline"
              name="tagline"
              autoComplete="off"
              placeholder="e.g. Master modern web skills with live cohort coaching"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className={inputClassLg}
            />
            <p className="text-[13px] text-neutral-400">
              You can configure your curriculum tools and add-on packs whenever you create a program.
            </p>
          </div>

          <Turnstile />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleBack}
              className={cn(btn('secondary', 'xl'), 'flex-1')}
            >
              <PiArrowLeftBold className="h-4 w-4" />
              Back
            </button>
            <SubmitButton
              size="xl"
              pendingLabel="Setting up your space…"
              className="flex-[2] gap-2 font-semibold"
            >
              Complete setup &amp; launch space
              <PiCheckBold className="h-4 w-4" />
            </SubmitButton>
          </div>
        </div>
      </form>
    </div>
  );
}
