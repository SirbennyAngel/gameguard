import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Reputation Manager Test Suite
Clarinet.test({
  name: "Test modify-reputation: Successful positive reputation modification",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'modify-reputation', [
        types.principal(wallet1.address),
        types.uint(50),
        types.bool(true),
        types.ascii('Good behavior')
      ], deployer.address)
    ]);

    block.receipts[0].result.expectOk();

    // Verify user reputation
    const getUserReputation = chain.callReadOnlyFn(
      'reputation-manager', 
      'get-user-reputation', 
      [types.principal(wallet1.address)], 
      deployer.address
    );

    const reputation = getUserReputation.result.expectSome().expectTuple();
    assertEquals(reputation.current_score, 50);
    assertEquals(reputation.total_actions, 1);
    assertEquals(reputation.positive_actions, 1);
  }
});

Clarinet.test({
  name: "Test modify-reputation: Successful negative reputation modification",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'modify-reputation', [
        types.principal(wallet1.address),
        types.uint(25),
        types.bool(false),
        types.ascii('Negative behavior')
      ], deployer.address)
    ]);

    block.receipts[0].result.expectOk();

    // Verify user reputation
    const getUserReputation = chain.callReadOnlyFn(
      'reputation-manager', 
      'get-user-reputation', 
      [types.principal(wallet1.address)], 
      deployer.address
    );

    const reputation = getUserReputation.result.expectSome().expectTuple();
    assertEquals(reputation.current_score, 0);
    assertEquals(reputation.total_actions, 1);
    assertEquals(reputation.negative_actions, 1);
  }
});

Clarinet.test({
  name: "Test modify-reputation: Prevent unauthorized reputation modification",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    const block = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'modify-reputation', [
        types.principal(wallet1.address),
        types.uint(50),
        types.bool(true),
        types.ascii('Good behavior')
      ], wallet2.address)
    ]);

    block.receipts[0].result.expectErr().expectUint(1000); // ERR_UNAUTHORIZED
  }
});

Clarinet.test({
  name: "Test check-reputation-threshold: Pass threshold check",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // First, modify reputation
    const modifyBlock = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'modify-reputation', [
        types.principal(wallet1.address),
        types.uint(75),
        types.bool(true),
        types.ascii('Good behavior')
      ], deployer.address)
    ]);

    // Then check threshold
    const thresholdCheck = chain.callReadOnlyFn(
      'reputation-manager', 
      'check-reputation-threshold', 
      [types.principal(wallet1.address), types.uint(50)], 
      deployer.address
    );

    thresholdCheck.result.expectBool(true);
  }
});

Clarinet.test({
  name: "Test check-reputation-threshold: Fail threshold check",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // First, modify reputation
    const modifyBlock = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'modify-reputation', [
        types.principal(wallet1.address),
        types.uint(25),
        types.bool(false),
        types.ascii('Negative behavior')
      ], deployer.address)
    ]);

    // Then check threshold
    const thresholdCheck = chain.callReadOnlyFn(
      'reputation-manager', 
      'check-reputation-threshold', 
      [types.principal(wallet1.address), types.uint(50)], 
      deployer.address
    );

    thresholdCheck.result.expectBool(false);
  }
});

Clarinet.test({
  name: "Test transfer-admin: Successful admin transfer",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'transfer-admin', [
        types.principal(wallet1.address)
      ], deployer.address)
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Test transfer-admin: Prevent unauthorized admin transfer",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    const block = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'transfer-admin', [
        types.principal(wallet1.address)
      ], wallet2.address)
    ]);

    block.receipts[0].result.expectErr().expectUint(1000); // ERR_UNAUTHORIZED
  }
});

Clarinet.test({
  name: "Test reputation boundary conditions",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // First, max out reputation
    const maxReputationBlock = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'modify-reputation', [
        types.principal(wallet1.address),
        types.uint(1000),
        types.bool(true),
        types.ascii('Outstanding behavior')
      ], deployer.address)
    ]);

    // Attempt to exceed max reputation
    const overMaxBlock = chain.mineBlock([
      Tx.contractCall('reputation-manager', 'modify-reputation', [
        types.principal(wallet1.address),
        types.uint(100),
        types.bool(true),
        types.ascii('More good behavior')
      ], deployer.address)
    ]);

    overMaxBlock.receipts[0].result.expectOk();

    // Verify max reputation was not exceeded
    const getUserReputation = chain.callReadOnlyFn(
      'reputation-manager', 
      'get-user-reputation', 
      [types.principal(wallet1.address)], 
      deployer.address
    );

    const reputation = getUserReputation.result.expectSome().expectTuple();
    assertEquals(reputation.current_score, 1000);
  }
});