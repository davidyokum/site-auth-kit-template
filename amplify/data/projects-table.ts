/**
 * The sample app's data: a private DynamoDB table of projects (03 §2 Foundation: "the database is
 * private"). The server reads and writes it with the SSR compute role; browsers never touch it.
 * Replace it with your site's own tables, keeping the same shape of protections.
 *
 * - partition key `id`; index `recent` (entity, createdAt) for the list of every project that site
 *   admins see. A member's own list comes from their resource roles (auth-kit's access table), then
 *   one BatchGetItem here.
 * - on-demand billing, point-in-time recovery, deletion protection, retained if the stack is deleted
 *   (except in a throwaway sandbox, detected from Amplify's CDK context).
 */
import { RemovalPolicy, Tags, aws_dynamodb as dynamodb, type aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PROJECTS_SCHEMA } from './projects-table.schema';

/** Amplify's CDK context key for the kind of deployment (`sandbox`, `branch`, `standalone`). */
const DEPLOYMENT_TYPE_CONTEXT_KEY = 'amplify-backend-type';

export { PROJECTS_SCHEMA };

export interface ProjectsTableProps {
  /** A throwaway sandbox: no deletion protection, removed with the stack. Default: from Amplify's context. */
  sandbox?: boolean;
}

export class ProjectsTable extends Construct {
  readonly table: dynamodb.TableV2;
  readonly tableName: string;
  readonly tableArn: string;

  constructor(scope: Construct, id: string, props: ProjectsTableProps = {}) {
    super(scope, id);
    const sandbox = props.sandbox ?? this.node.tryGetContext(DEPLOYMENT_TYPE_CONTEXT_KEY) === 'sandbox';
    const { recent } = PROJECTS_SCHEMA.indexes;
    this.table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: PROJECTS_SCHEMA.partitionKey, type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: !sandbox,
      removalPolicy: sandbox ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: recent.name,
          partitionKey: { name: recent.partitionKey, type: dynamodb.AttributeType.STRING },
          sortKey: { name: recent.sortKey, type: dynamodb.AttributeType.STRING },
          projectionType: dynamodb.ProjectionType.ALL,
        },
      ],
    });
    this.tableName = this.table.tableName;
    this.tableArn = this.table.tableArn;
    Tags.of(this).add('Data', 'projects');
  }

  /**
   * Exactly the calls lib/projects/dynamo.ts makes: GetItem, BatchGetItem, PutItem (creates and
   * edits, each conditional), and Query (on the table and, because it has an index, `<table>/index/*`).
   * No Scan, UpdateItem, or DeleteItem.
   */
  grantApp(grantee: iam.IGrantable): void {
    this.table.grant(grantee, 'dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:PutItem', 'dynamodb:Query');
  }
}
