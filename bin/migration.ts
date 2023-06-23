#!/usr/bin/env node
import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';
import { MigrationStack } from '../lib/migration-stack';

const app = new cdk.App();
new MigrationStack(app, 'MigrationStack');
