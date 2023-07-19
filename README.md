# MongoDB Auto Event Driven Architecture

This library is designed to make building an event driven application using MongoDB as easy and ✨magical✨
as possible. It uses [MongoDB's ChangeStreams](https://www.mongodb.com/docs/manual/changeStreams/)
to detect updates and trigger jobs, and it tries to execute those jobs in a sensible order to minimise duplicate work.

Note: at the moment the library only works in
conjunction with [Typegoose](https://typegoose.github.io/typegoose/).

## Worked Example

The easiest way to explain would probably be with an example. Let's say we have an accounts collection and a
transactions collection, and want to ensure that:
* An account always has a corresponding directory on disk where we can put account statements
* An account's balance is the sum of its transaction's amounts plus an initial balance
* There aren't any transactions with the same amount

First, lets define some very simple models:

```typescript
import { getModelForClass, prop } from '@typegoose/typegoose';
import { ObjectId } from 'mongodb';

class Account {
    @prop()
    _id: ObjectId

    @prop()
    name: string
    
    @prop()
    initialBalance: number;

    @prop()
    balance: number
}

const AccountModel = getModelForClass(Account)

class Transaction {
    @prop()
    _id: ObjectId

    @prop()
    accountId: ObjectId

    @prop()
    amount: string
}

const TransactionModel = getModelForClass(Transaction)
```

Then, we define our jobs. Jobs can be defined using the `addJob` function, but decorators are preferred.
A good structure is  for each type/collection to have a `Consumer`, and for that consumer to contain jobs 
that are triggered by changes to the consumer's type. This is basically just syntactic sugar to stop you 
from repeating the same type over and over though - you can organise your jobs any way you like.

```typescript
import { Consumer } from './Consumer';
import { ChangeStreamDocument, ObjectId } from 'mongodb';
import { Job } from './Job';
import { JobTrigger } from './JobTrigger';
import { JobExpectedChange } from './JobExpectedChange';
import { Watcher } from './watcher';
import { Worker } from './worker';

@Consumer(Account)
class AccountConsumer {

    // This job will be triggered when a new account is created
    // or if the 'name' field is updated for an existing account
    @Job()
    @JobTrigger(['name'])
    makeDir(accountId: ObjectId) {
        // Make a directory with the account's name...
    }

    // This job will be triggered when:
    // * a new transaction is created, removed, or the field 'amount' is updated
    // * a new account is created or the 'initialBalance' field is updated
    // Because Transaction is a different type to Account, we have to define
    // a transformer to convert a transactionId into one, many or zero
    // accountIds.
    // We also say that in this job we expect that the 'balance' field might change.
    // This is just used for job ordering - if the job doesn't end up changing
    // that field it doesn't matter, and if it ends up changing a field
    // that isn't listed that will still trigger jobs (although you're at
    // risk of starting infinite loops)
    @Job()
    @JobTrigger(Transaction, {
        onCreate: true,
        onUpdate: ['amount'],
        onRemove: true,
        transformer: async (transactionId: ObjectId, event: ChangeStreamDocument): ObjectId | ObjectId[] | undefined => {
            // Get the account id from the transaction, or maybe
            // find and return every account id if you feel like it
        }
    })
    @JobTrigger(['initialBalance'])
    @JobExpectedChange(['balance'])
    updateBalance(accountId: ObjectId) {
        // Update balance...
    }
}

@Consumer(Transaction)
class TransactionConsumer {

    // This job will be triggered when a new transaction is added
    // or the 'amount' field is updated.
    // This job is designed to run on all transactions at once. Because
    // of that, if we add 5 transactions in a row, we don't want to run
    // this job 5 times - we want to wait for those jobs to finish, and
    // then run this one once. That's what the 'batch' option does.
    // We're also saying that this job *might* delete a transaction.
    @Job({ batch: true })
    @JobTrigger(['amount'])
    @JobExpectChange({ removes: true })
    removeDuplicates() {
        // Get all the transactions and make sure there are no duplicates
    }

    // Not every job needs to have a trigger. Jobs can be run manually by
    // the JobManager. This job's name is 
    // 'TransactionConsumer<Transaction>.injestTransactions'.
    @Job()
    @JobExpectChange({ creates: true })
    injestTransactions() {
        // Find and insert transactions
    }
}

// You don't have to instanciate the consumer - but if you do,
// jobs and transformers will have their 'this' variable
// bound to the instance. Useful if you're using dependency injection.
// You'll receive a warning if multiple instances are created, but jobs
// will only run once no matter how many instances you create, on the first
// instance that was created.
const accountConsumer = new AccountConsumer()

// The watcher is what listens to the MongoDB ChangeStream. It is
// responsible for running transformers and queuing jobs
new Watcher().start()

// The worker takes jobs from the queue, checks if they're ready to be run
// and then executes them
new Worker().start()

// Only one watcher should be running, but as many workers can run at once.
// The watcher and worker could all run in the main thread, but it's 
// probably more sensible to run them as separate processes
```
