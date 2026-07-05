import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { Button, Input, Card, CardHeader } from '../components/ui';
import { useDropzone } from 'react-dropzone';
import {
  Github,
  Upload,
  FileArchive,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const githubSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  github_url: z.string().url('Please enter a valid GitHub URL').refine(
    (val) => val.includes('github.com'),
    { message: 'URL must be from github.com' }
  ),
  branch: z.string().optional(),
});

const uploadSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
});

type GithubFormData = z.infer<typeof githubSchema>;
type UploadFormData = z.infer<typeof uploadSchema>;

export function NewProjectPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'github' | 'upload'>('github');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [creatingAndStarting, setCreatingAndStarting] = useState(false);

  const githubForm = useForm<GithubFormData>({
    resolver: zodResolver(githubSchema),
    defaultValues: {
      branch: 'main',
    },
  });

  const uploadForm = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        setUploadError('File size must be less than 100MB');
        return;
      }
      if (!file.name.endsWith('.zip')) {
        setUploadError('Only ZIP files are supported');
        return;
      }
      setUploadedFile(file);
      setUploadError(null);
      uploadForm.setValue('name', file.name.replace('.zip', ''));
    }
  }, [uploadForm]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    maxFiles: 1,
  });

  async function handleGithubSubmit(data: GithubFormData) {
    setCreatingAndStarting(true);
    setUploadError(null);

    try {
      // Step 1: Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: data.name,
          source_type: 'GITHUB',
          github_url: data.github_url,
          default_branch: data.branch || 'main',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Step 2: Create a review
      const { data: review, error: reviewError } = await supabase
        .from('reviews')
        .insert({
          project_id: project.id,
          status: 'QUEUED',
          branch: data.branch || 'main',
        })
        .select()
        .single();

      if (reviewError) throw reviewError;

      // Step 3: Trigger the edge function (fire and forget, but catch errors)
      fetch(`${supabaseUrl}/functions/v1/run-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ review_id: review.id, project_id: project.id }),
      }).catch((err) => console.error('Failed to trigger review:', err));

      // Step 4: Navigate to the review progress page
      navigate(`/reviews/${review.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      setUploadError('Failed to create project. Please try again.');
      setCreatingAndStarting(false);
    }
  }

  async function handleUploadSubmit(data: UploadFormData) {
    if (!uploadedFile) {
      setUploadError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: data.name,
          source_type: 'ZIP',
        })
        .select()
        .single();

      if (error) throw error;
      navigate(`/projects/${project.id}`);
    } catch (error) {
      console.error('Error uploading:', error);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create New Project</h1>
        <p className="text-slate-500 mt-1">
          Connect a GitHub repository or upload a ZIP file
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setMode('github')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'github'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Github className="w-4 h-4" />
          GitHub URL
        </button>
        <button
          onClick={() => setMode('upload')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'upload'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Upload className="w-4 h-4" />
          Upload ZIP
        </button>
      </div>

      {mode === 'github' ? (
        <Card>
          <CardHeader
            title="GitHub Repository"
            subtitle="Enter the URL of a public GitHub repository"
          />
          <form onSubmit={githubForm.handleSubmit(handleGithubSubmit)} className="space-y-5">
            <Input
              label="Project Name"
              placeholder="My Awesome Project"
              error={githubForm.formState.errors.name?.message}
              {...githubForm.register('name')}
            />
            <Input
              label="GitHub URL"
              placeholder="https://github.com/owner/repo"
              error={githubForm.formState.errors.github_url?.message}
              {...githubForm.register('github_url')}
            />
            <Input
              label="Branch"
              placeholder="main"
              helperText="Default branch to analyze"
              error={githubForm.formState.errors.branch?.message}
              {...githubForm.register('branch')}
            />
            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={creatingAndStarting} disabled={creatingAndStarting}>
                {creatingAndStarting ? 'Starting Review...' : 'Create & Start Review'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/projects')}
                disabled={creatingAndStarting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Upload ZIP File"
            subtitle="Upload a ZIP file containing your source code"
          />
          <form onSubmit={uploadForm.handleSubmit(handleUploadSubmit)} className="space-y-5">
            <Input
              label="Project Name"
              placeholder="My Awesome Project"
              error={uploadForm.formState.errors.name?.message}
              {...uploadForm.register('name')}
            />

            {/* Dropzone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Source Code (ZIP)
              </label>
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-slate-400 bg-slate-50'
                    : 'border-slate-300 hover:border-slate-400',
                  uploadedFile && 'border-emerald-300 bg-emerald-50'
                )}
              >
                <input {...getInputProps()} />
                {uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="font-medium text-slate-900">{uploadedFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <FileArchive className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-900">
                      {isDragActive ? 'Drop the file here' : 'Drag & drop a ZIP file'}
                    </p>
                    <p className="text-sm text-slate-500">or click to browse (max 100MB)</p>
                  </div>
                )}
              </div>
              {uploadError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={uploading} disabled={!uploadedFile}>
                Create Project
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/projects')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
