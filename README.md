# AWS DynamoDB Migration Tool (AWS CDK)

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

AWS DynamoDB Migration Tool is a robust utility built with AWS Cloud Development Kit (CDK) that simplifies the process of migrating data between AWS DynamoDB tables. It's ideal for re-structuring tables, moving data between AWS accounts, or creating backups.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [AWS CDK Deployment](#aws-cdk-deployment)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

- Migrate data between DynamoDB tables within the same AWS account or across different accounts.
- Filter data during migration using various criteria.
- Built with AWS CDK for easy infrastructure deployment.
- Support for all AWS regions.
- Easy to use CLI interface.
- Highly configurable and customizable.

## Prerequisites

- Node.js (>= 18.x)
- AWS CLI configured with appropriate permissions.
- AWS CDK installed (`npm install -g aws-cdk`).

## Installation

1. Clone the repository:

```sh
git clone https://github.com/dobeerman/aws-dynamodb-migration.git
```

2. Navigate to the repository directory:

```sh
cd aws-dynamodb-migration
```

3. Install the dependencies:

```sh
npm install
```

## AWS CDK Deployment

Bootstrap your AWS environment to use the CDK:

```sh
cdk bootstrap
```

Deploy the CDK stack:

```sh
cdk deploy
```

Note: The cdk deploy command deploys the stack to your AWS account. Make sure you review any changes before deploying them.

## Usage

Configure the `event.json` file with source and destination table details, and other options.

### Run the migration script:

Grab the lambda function name from the deployment output then use it in the following commanf

```sh
aws lambda invoke --function-name <function-name-from-output> --payload fileb://event.json
```

Monitor the progress in the console. The script will log the status of the migration process.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

1. Fork the Project
2. Create your Feature Branch (git checkout -b feat/AmazingFeature)
3. Commit your Changes (git commit -m 'Add some AmazingFeature')
4. Push to the Branch (git push origin feat/AmazingFeature)
5. Open a Pull Request

## License

Distributed under the MIT License. See LICENSE for more information.
