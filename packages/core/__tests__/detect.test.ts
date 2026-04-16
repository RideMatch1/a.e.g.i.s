import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectStack } from '../src/detect.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-detect-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writePkg(dir: string, pkg: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

describe('detectStack — Next.js + Supabase', () => {
  it('detects nextjs framework and supabase database/auth', () => {
    writePkg(tmpDir, {
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
        '@supabase/supabase-js': '^2.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        vitest: '^1.0.0',
      },
    });
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, '__tests__'));

    const stack = detectStack(tmpDir);

    expect(stack.framework).toBe('nextjs');
    expect(stack.database).toBe('supabase');
    expect(stack.auth).toBe('supabase-auth');
    expect(stack.language).toBe('typescript');
    expect(stack.hasTests).toBe(true);
  });
});

describe('detectStack — React + Firebase', () => {
  it('detects react framework and firebase database', () => {
    writePkg(tmpDir, {
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        firebase: '^10.0.0',
      },
    });

    const stack = detectStack(tmpDir);

    expect(stack.framework).toBe('react');
    expect(stack.database).toBe('firebase');
  });
});

describe('detectStack — AI provider detection', () => {
  it('detects openai', () => {
    writePkg(tmpDir, {
      dependencies: {
        openai: '^4.0.0',
        react: '^18.0.0',
      },
    });
    const stack = detectStack(tmpDir);
    expect(stack.ai).toBe('openai');
  });

  it('detects anthropic', () => {
    writePkg(tmpDir, {
      dependencies: {
        '@anthropic-ai/sdk': '^0.20.0',
        next: '^14.0.0',
      },
    });
    const stack = detectStack(tmpDir);
    expect(stack.ai).toBe('anthropic');
  });

  it('detects mistral', () => {
    writePkg(tmpDir, {
      dependencies: {
        '@mistralai/mistralai': '^1.0.0',
        next: '^14.0.0',
      },
    });
    const stack = detectStack(tmpDir);
    expect(stack.ai).toBe('mistral');
  });

  it('detects none when no AI dep present', () => {
    writePkg(tmpDir, {
      dependencies: {
        next: '^14.0.0',
      },
    });
    const stack = detectStack(tmpDir);
    expect(stack.ai).toBe('none');
  });
});

describe('detectStack — Stripe payment', () => {
  it('detects stripe', () => {
    writePkg(tmpDir, {
      dependencies: {
        next: '^14.0.0',
        stripe: '^14.0.0',
        '@stripe/stripe-js': '^3.0.0',
      },
    });
    const stack = detectStack(tmpDir);
    expect(stack.payment).toBe('stripe');
  });

  it('returns none when no payment dep', () => {
    writePkg(tmpDir, {
      dependencies: { next: '^14.0.0' },
    });
    const stack = detectStack(tmpDir);
    expect(stack.payment).toBe('none');
  });
});

describe('detectStack — Docker deploy', () => {
  it('detects docker when Dockerfile present', () => {
    writePkg(tmpDir, {
      dependencies: { next: '^14.0.0' },
    });
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:20');

    const stack = detectStack(tmpDir);
    expect(stack.deploy).toBe('docker');
  });

  it('detects docker from docker-compose.yml', () => {
    writePkg(tmpDir, {
      dependencies: { express: '^4.0.0' },
    });
    fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'), 'version: "3"');

    const stack = detectStack(tmpDir);
    expect(stack.deploy).toBe('docker');
  });
});

describe('detectStack — Python Django', () => {
  it('detects django from requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'Django==4.2\npsycopg2-binary==2.9');

    const stack = detectStack(tmpDir);
    expect(stack.framework).toBe('django');
    expect(stack.language).toBe('python');
  });

  it('detects flask from requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'Flask==3.0\nsqlalchemy==2.0');

    const stack = detectStack(tmpDir);
    expect(stack.framework).toBe('flask');
    expect(stack.language).toBe('python');
  });
});

describe('detectStack — Ruby on Rails', () => {
  it('detects rails from Gemfile', () => {
    fs.writeFileSync(path.join(tmpDir, 'Gemfile'), "source 'https://rubygems.org'\ngem 'rails', '~> 7.1'");

    const stack = detectStack(tmpDir);
    expect(stack.framework).toBe('rails');
    expect(stack.language).toBe('ruby');
  });
});

describe('detectStack — i18n detection', () => {
  it('detects i18n from next-intl dependency', () => {
    writePkg(tmpDir, {
      dependencies: { next: '^14.0.0', 'next-intl': '^3.0.0' },
    });
    const stack = detectStack(tmpDir);
    expect(stack.hasI18n).toBe(true);
  });

  it('detects i18n from locales directory', () => {
    writePkg(tmpDir, {
      dependencies: { next: '^14.0.0' },
    });
    fs.mkdirSync(path.join(tmpDir, 'locales'));

    const stack = detectStack(tmpDir);
    expect(stack.hasI18n).toBe(true);
  });

  it('returns false when no i18n', () => {
    writePkg(tmpDir, {
      dependencies: { next: '^14.0.0' },
    });
    const stack = detectStack(tmpDir);
    expect(stack.hasI18n).toBe(false);
  });
});

describe('detectStack — Prisma ORM', () => {
  it('detects prisma', () => {
    writePkg(tmpDir, {
      dependencies: { '@prisma/client': '^5.0.0' },
      devDependencies: { prisma: '^5.0.0', next: '^14.0.0' },
    });
    const stack = detectStack(tmpDir);
    expect(stack.database).toBe('prisma');
  });
});

describe('detectStack — Vercel deploy', () => {
  it('detects vercel from vercel.json', () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(path.join(tmpDir, 'vercel.json'), '{}');

    const stack = detectStack(tmpDir);
    expect(stack.deploy).toBe('vercel');
  });
});
