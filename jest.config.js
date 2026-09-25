const common = { testEnvironment: 'node', transform: {}, setupFiles: ['<rootDir>/tests/helpers/testEnv.js'] };

export default {
  projects: [
    { ...common, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.js'] },
    {
      ...common,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
      globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
    },
  ],
};
