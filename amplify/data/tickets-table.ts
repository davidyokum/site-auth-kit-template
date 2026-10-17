/**
 * The sample app's data: a private DynamoDB table of tickets (03 §2 Foundation: "the database is
 * private"). The server reads and writes it with the SSR compute role; browsers never touch it.
 * Replace it with your site's own tables, keeping the same shape of protections.
 *
 * - partition key `id`; index `byOwner` (ownerSub, createdAt) so a member's list is a Query filtered
 *   on the server, never a scan filtered in the browser; index `recent` (entity, createdAt) for the
 *   staff view of every ticket.
 * - on-demand billing, point-in-time recovery, deletion protection, retained if the stack is deleted
 *   (except in a throwaway sandbox, detected from Amplify's CDK context).
 */
import { RemovalPolicy, Tags, aws_dynamodb as dynamodb, type aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { TICKETS_SCHEMA } from './tickets-table.schema';

/** Amplify's CDK context key for the kind of deployment (`sandbox`, `branch`, `standalone`). */
const DEPLOYMENT_TYPE_CONTEXT_KEY = 'amplify-backend-type';

export { TICKETS_SCHEMA };

export interface TicketsTableProps {
  /** A throwaway sandbox: no deletion protection, removed with the stack. Default: from Amplify's context. */
  sandbox?: boolean;
}

export class TicketsTable extends Construct {
  readonly table: dynamodb.TableV2;
  readonly tableName: string;
  readonly tableArn: string;

  constructor(scope: Construct, id: string, props: TicketsTableProps = {}) {
    super(scope, id);
    const sandbox = props.sandbox ?? this.node.tryGetContext(DEPLOYMENT_TYPE_CONTEXT_KEY) === 'sandbox';
    const { byOwner, recent } = TICKETS_SCHEMA.indexes;
    this.table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: TICKETS_SCHEMA.partitionKey, type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: !sandbox,
      removalPolicy: sandbox ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [byOwner, recent].map((index) => ({
        indexName: index.name,
        partitionKey: { name: index.partitionKey, type: dynamodb.AttributeType.STRING },
        sortKey: { name: index.sortKey, type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      })),
    });
    this.tableName = this.table.tableName;
    this.tableArn = this.table.tableArn;
    Tags.of(this).add('Data', 'tickets');
  }

  /**
   * Exactly the calls lib/tickets/dynamo.ts makes: GetItem, PutItem, and Query (on the table and,
   * because it has indexes, `<table>/index/*`). No Scan, UpdateItem, or DeleteItem.
   */
  grantApp(grantee: iam.IGrantable): void {
    this.table.grant(grantee, 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query');
  }
}
