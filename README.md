# jsPsych Data Manager

A package to manage data for jsPsych experiments. This project provides utilities to save experiment data to various backends. Currently, Firebase and Supabase are supported.

## Installation

```bash
# Install the core package and any backend you need
npm install @jspsych-datamanager/core @jspsych-datamanager/firebase
# or
npm install @jspsych-datamanager/core @jspsych-datamanager/supabase
```

## Usage

### Firebase

```javascript
import { initJsPsych } from 'jspsych';
import { FirebaseManager, FirebaseConfig } from '@jspsych-datamanager/firebase';

// Your Firebase config
const firebaseConfig = {
  apiKey: 'your-api-key',
  authDomain: 'your-auth-domain',
  projectId: 'your-project-id',
  storageBucket: 'your-storage-bucket',
  messagingSenderId: 'your-messaging-sender-id',
  appId: 'your-app-id'
};

// Create a Firebase data manager
const dataManager = new FirebaseManager(firebaseConfig, {
  collectionName: 'experiments',
  metadata: {
    version: '1.0.0',
    experimentName: 'My Experiment'
  }
});

// Initialize jsPsych with the data manager
const jsPsych = initJsPsych({
  on_data_update: dataManager.createDataUpdateCallback(),
  on_finish: dataManager.createFinishCallback()
});

// Initialize the experiment document in Firebase
await dataManager.initializeExperiment({
  participantId: 'participant123',
  condition: 'control'
});

// Run your experiment
jsPsych.run([/* your trial timeline */]);
```

### Supabase

```javascript
import { initJsPsych } from 'jspsych';
import { SupabaseManager, SupabaseConfig } from '@jspsych-datamanager/supabase';

// Your Supabase config
const supabaseConfig = {
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key'
};

// Create a Supabase data manager
const dataManager = new SupabaseManager(supabaseConfig, {
  tableName: 'experiments',
  metadata: {
    version: '1.0.0',
    experimentName: 'My Experiment'
  }
});

// Initialize jsPsych with the data manager
const jsPsych = initJsPsych({
  on_data_update: dataManager.createDataUpdateCallback(),
  on_finish: dataManager.createFinishCallback()
});

// Initialize the experiment in Supabase
await dataManager.initializeExperiment({
  participantId: 'participant123',
  condition: 'control'
});

// Run your experiment
jsPsych.run([/* your trial timeline */]);
```

## Development

This project uses pnpm as its package manager and is structured as a monorepo with the following packages:

- `packages/core`: Core functionality and interfaces
- `packages/firebase`: Firebase integration
- `packages/supabase`: Supabase integration

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build a specific package
pnpm build:core
pnpm build:firebase
pnpm build:supabase
```

## License

MIT 