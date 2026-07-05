import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import {
  Code2,
  Shield,
  Zap,
  Sparkles,
  FlaskConical,
  Network,
  ArrowRight,
  CheckCircle,
  BarChart3,
  GitBranch,
  Lock,
  Users,
  Clock,
} from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Security Analysis',
    description:
      'Detect SQL injection, XSS, secrets leakage, and 200+ vulnerability patterns with CWE mapping.',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
  },
  {
    icon: Network,
    title: 'Architecture Review',
    description:
      'Analyze project structure, dependency graphs, SOLID principles, and design patterns.',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
  },
  {
    icon: Sparkles,
    title: 'Code Quality',
    description:
      'Check naming conventions, code smells, duplication, and clean code best practices.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
  },
  {
    icon: Zap,
    title: 'Performance',
    description:
      'Identify bottlenecks, N+1 queries, memory leaks, and optimization opportunities.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
  },
  {
    icon: FlaskConical,
    title: 'Testing Coverage',
    description:
      'Assess test coverage gaps, missing edge cases, and generate suggested test cases.',
    color: 'text-violet-500',
    bgColor: 'bg-violet-50',
  },
];

const capabilities = [
  'Multi-agent specialized analysis',
  'Evidence-backed findings with file locations',
  'Prioritized recommendations',
  'GitHub & ZIP repository support',
  'Detailed reports with PDF export',
  'Score breakdowns by category',
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">CodeReview AI</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link to="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-medium mb-8">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            Powered by advanced AI agents
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight">
            Your code, reviewed by
            <span className="block text-slate-500">specialized AI agents</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Get comprehensive code reviews from multiple AI agents, each specializing in
            security, architecture, performance, code quality, and testing. Evidence-backed
            findings, prioritized recommendations, and actionable fixes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Start Free Review
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            No credit card required. Review up to 3 repositories free.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Five specialized agents, one comprehensive review
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Each agent focuses on a specific domain, delivering expert-level analysis
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div
                  className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-4`}
                >
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              How it works
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Three simple steps to get a comprehensive code review
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                <GitBranch className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                1. Connect Repository
              </h3>
              <p className="text-slate-600">
                Provide a GitHub URL or upload a ZIP file. We support public repositories
                and will validate the structure.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                2. AI Agents Analyze
              </h3>
              <p className="text-slate-600">
                Five specialized agents analyze your codebase in parallel, each focusing
                on their domain of expertise.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                3. Get Report
              </h3>
              <p className="text-slate-600">
                Receive a detailed report with scores, evidence-backed findings, and
                prioritized recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Enterprise-grade code review capabilities
              </h2>
              <p className="text-slate-400 text-lg mb-8">
                Our multi-agent system delivers comprehensive analysis that goes beyond
                simple linting or single-AI solutions.
              </p>
              <ul className="space-y-4">
                {capabilities.map((capability) => (
                  <li key={capability} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">{capability}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <Clock className="w-8 h-8 text-blue-400 mb-3" />
                <p className="text-3xl font-bold text-white">Under 5 min</p>
                <p className="text-slate-400 text-sm mt-1">
                  Average review time for standard repos
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <Lock className="w-8 h-8 text-emerald-400 mb-3" />
                <p className="text-3xl font-bold text-white">95%+</p>
                <p className="text-slate-400 text-sm mt-1">
                  Findings with valid evidence
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <Users className="w-8 h-8 text-amber-400 mb-3" />
                <p className="text-3xl font-bold text-white">5 Agents</p>
                <p className="text-slate-400 text-sm mt-1">
                  Specialized analysis domains
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <BarChart3 className="w-8 h-8 text-violet-400 mb-3" />
                <p className="text-3xl font-bold text-white">10K+</p>
                <p className="text-slate-400 text-sm mt-1">
                  Files supported per review
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Ready to improve your code quality?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Start your first code review today. No credit card required.
          </p>
          <Link to="/signup">
            <Button size="lg" className="gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">CodeReview AI</span>
          </div>
          <p className="text-sm text-slate-500">
            Built with advanced AI to help developers write better code.
          </p>
        </div>
      </footer>
    </div>
  );
}