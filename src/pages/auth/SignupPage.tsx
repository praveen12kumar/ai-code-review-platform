import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../../components/ui';
import { Code2, AlertCircle, CheckCircle } from 'lucide-react';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setError(null);
    setLoading(true);
    const { error } = await signUp(data.email, data.password, data.name);
    setLoading(false);
    if (error) {
      if (error.message.includes('already registered')) {
        setError('An account with this email already exists.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                <Code2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">CodeReview AI</span>
            </Link>
          </div>

          <div className="mt-8 bg-white py-8 px-6 shadow-sm rounded-xl border border-slate-200 sm:px-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Account created!
              </h2>
              <p className="text-slate-600 mb-6">
                Please check your email to verify your account, then sign in.
              </p>
              <Link to="/login">
                <Button className="w-full">Go to Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">CodeReview AI</span>
          </Link>
        </div>
        <h2 className="mt-8 text-center text-2xl font-bold text-slate-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-slate-900 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-slate-200 sm:px-10">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Full name"
              type="text"
              placeholder="John Doe"
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Create a strong password"
              helperText="At least 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              label="Confirm password"
              type="password"
              placeholder="Confirm your password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <div className="pt-2">
              <p className="text-xs text-slate-500">
                By signing up, you agree to our{' '}
                <a href="#" className="text-slate-700 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-slate-700 hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Create account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}