import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { register } from "../../api/auth";
import { extractErrorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/Feedback";
import { FieldError } from "../../components/FieldError";
import { Input } from "../../components/Input";
import { Logo } from "../../components/Logo";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { registerSchema, type RegisterFormValues } from "../../lib/authSchemas";
import type { ClassType } from "../../api/types";

const CLASS_TYPES: ClassType[] = ["SCIENCE", "MATH", "INFO", "ECO"];

export function RegisterPage() {
  useDocumentTitle("Create account");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register: registerField,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      role: "PUPIL",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      requestedType: "MATH",
      teacherCode: "",
      phone: "",
      parentPhone: "",
    } as RegisterFormValues,
  });

  const role = watch("role");
  const pupilErrors = errors as FieldErrors<Extract<RegisterFormValues, { role: "PUPIL" }>>;

  const mutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      values.role === "PUPIL"
        ? register({ ...values, teacherCode: values.teacherCode.toUpperCase() })
        : register(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/verify-email");
    },
  });

  return (
    <div className="flex min-h-svh">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="h-10 w-10" />
          <h1 className="mt-6 text-2xl font-bold text-ink-900">Create your account</h1>
          <p className="mt-1 text-sm text-ink-500">Choose the account type that fits you.</p>

          <div role="radiogroup" aria-label="Account type" className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["PUPIL", "TEACHER", "PARENT"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setValue("role", r, { shouldValidate: true })}
                className={clsx(
                  "focus-ring min-h-11 rounded-sm border px-3 py-2.5 text-sm font-medium transition-colors",
                  role === r
                    ? "border-accent-600 bg-accent-50 text-accent-600"
                    : "border-border-strong text-ink-700 hover:bg-canvas"
                )}
              >
                {r === "PUPIL" ? "Pupil" : r === "TEACHER" ? "Teacher" : "Parent"}
              </button>
            ))}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
            <div>
              <label htmlFor="register-name" className="text-sm font-medium text-ink-700">
                Full name <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Input
                id="register-name"
                required
                aria-required="true"
                invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "register-name-error" : undefined}
                {...registerField("name")}
              />
              <FieldError id="register-name-error" message={errors.name?.message} />
            </div>
            <div>
              <label htmlFor="register-email" className="text-sm font-medium text-ink-700">
                Email <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Input
                id="register-email"
                type="email"
                required
                aria-required="true"
                invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "register-email-error" : undefined}
                {...registerField("email")}
              />
              <FieldError id="register-email-error" message={errors.email?.message} />
            </div>
            <div>
              <label htmlFor="register-password" className="text-sm font-medium text-ink-700">
                Password <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Input
                id="register-password"
                type="password"
                required
                aria-required="true"
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "register-password-error" : undefined}
                {...registerField("password")}
              />
              <FieldError id="register-password-error" message={errors.password?.message} />
            </div>
            <div>
              <label htmlFor="register-confirm-password" className="text-sm font-medium text-ink-700">
                Confirm password <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Input
                id="register-confirm-password"
                type="password"
                required
                aria-required="true"
                invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? "register-confirm-password-error" : undefined}
                {...registerField("confirmPassword")}
              />
              <FieldError id="register-confirm-password-error" message={errors.confirmPassword?.message} />
            </div>

            {role === "PUPIL" && (
              <>
                <div>
                  <label htmlFor="register-class-type" className="text-sm font-medium text-ink-700">
                    Class type
                  </label>
                  <select
                    id="register-class-type"
                    {...registerField("requestedType")}
                    className="focus-ring mt-1 w-full rounded-sm border border-border-strong bg-surface px-3 py-3 text-sm text-ink-900"
                  >
                    {CLASS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="register-teacher-code" className="text-sm font-medium text-ink-700">
                    Teacher ID <span className="text-danger-600" aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="register-teacher-code"
                    placeholder="e.g. PFBV9U"
                    required
                    aria-required="true"
                    invalid={Boolean(pupilErrors.teacherCode)}
                    aria-describedby={pupilErrors.teacherCode ? "register-teacher-code-error register-teacher-code-hint" : "register-teacher-code-hint"}
                    {...registerField("teacherCode")}
                    className="font-mono uppercase tracking-wider"
                  />
                  <p id="register-teacher-code-hint" className="mt-1 text-xs text-ink-400">
                    Ask your teacher for their Teacher ID.
                  </p>
                  <FieldError id="register-teacher-code-error" message={pupilErrors.teacherCode?.message} />
                </div>
                <div>
                  <label htmlFor="register-phone" className="text-sm font-medium text-ink-700">
                    Phone number <span className="text-danger-600" aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="register-phone"
                    type="tel"
                    required
                    aria-required="true"
                    invalid={Boolean(pupilErrors.phone)}
                    aria-describedby={pupilErrors.phone ? "register-phone-error" : undefined}
                    {...registerField("phone")}
                  />
                  <FieldError id="register-phone-error" message={pupilErrors.phone?.message} />
                </div>
                <div>
                  <label htmlFor="register-parent-phone" className="text-sm font-medium text-ink-700">
                    Parent's phone number <span className="text-danger-600" aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="register-parent-phone"
                    type="tel"
                    required
                    aria-required="true"
                    invalid={Boolean(pupilErrors.parentPhone)}
                    aria-describedby={pupilErrors.parentPhone ? "register-parent-phone-error" : undefined}
                    {...registerField("parentPhone")}
                  />
                  <FieldError id="register-parent-phone-error" message={pupilErrors.parentPhone?.message} />
                </div>
              </>
            )}

            {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Already have an account?{" "}
            <Link to="/login" className="focus-ring rounded-sm font-medium text-accent-600 hover:text-accent-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
    </div>
  );
}
