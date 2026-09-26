import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL only registers its own unmount hook when Vitest globals are enabled; they are not.
afterEach(cleanup);
