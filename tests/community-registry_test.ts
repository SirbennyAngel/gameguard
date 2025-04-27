import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Community Registry Test Suite
Clarinet.test({
  name: "Test create-community: Successful community creation",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    const block = chain.mineBlock([
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('A community for passionate gamers'),
        types.uint(100)
      ], deployer.address)
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify community details
    const getCommunityDetails = chain.callReadOnlyFn(
      'community-registry', 
      'get-community-details', 
      [types.ascii('GamersUnite')], 
      deployer.address
    );

    getCommunityDetails.result.expectSome();
  }
});

Clarinet.test({
  name: "Test create-community: Prevent duplicate community creation",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    const block = chain.mineBlock([
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('A community for passionate gamers'),
        types.uint(100)
      ], deployer.address),
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('Another description'),
        types.uint(50)
      ], deployer.address)
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectErr().expectUint(409); // ERR_COMMUNITY_EXISTS
  }
});

Clarinet.test({
  name: "Test add-administrator: Successful administrator addition",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    const createBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('A community for passionate gamers'),
        types.uint(100)
      ], deployer.address)
    ]);

    const addAdminBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'add-administrator', [
        types.ascii('GamersUnite'),
        types.principal(wallet1.address)
      ], deployer.address)
    ]);

    addAdminBlock.receipts[0].result.expectOk().expectBool(true);

    // Verify administrator was added
    const getAdmins = chain.callReadOnlyFn(
      'community-registry', 
      'get-community-administrators', 
      [types.ascii('GamersUnite')], 
      deployer.address
    );

    // Check that wallet1 is now an administrator
    const admins = getAdmins.result.expectList();
    assertEquals(admins.length, 2);
  }
});

Clarinet.test({
  name: "Test add-administrator: Prevent unauthorized administrator addition",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    const createBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('A community for passionate gamers'),
        types.uint(100)
      ], deployer.address)
    ]);

    const addAdminBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'add-administrator', [
        types.ascii('GamersUnite'),
        types.principal(wallet1.address)
      ], wallet2.address)
    ]);

    addAdminBlock.receipts[0].result.expectErr().expectUint(403); // ERR_UNAUTHORIZED
  }
});

Clarinet.test({
  name: "Test request-membership: Successful membership request",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    const createBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('A community for passionate gamers'),
        types.uint(100)
      ], deployer.address)
    ]);

    const requestMembershipBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'request-membership', [
        types.ascii('GamersUnite')
      ], wallet1.address)
    ]);

    requestMembershipBlock.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Test approve-membership: Successful membership approval",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    const createBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('A community for passionate gamers'),
        types.uint(100)
      ], deployer.address)
    ]);

    const requestMembershipBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'request-membership', [
        types.ascii('GamersUnite')
      ], wallet1.address)
    ]);

    const approveMembershipBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'approve-membership', [
        types.ascii('GamersUnite'),
        types.principal(wallet1.address)
      ], deployer.address)
    ]);

    approveMembershipBlock.receipts[0].result.expectOk().expectBool(true);

    // Verify membership
    const isMember = chain.callReadOnlyFn(
      'community-registry', 
      'is-community-member', 
      [types.ascii('GamersUnite'), types.principal(wallet1.address)], 
      deployer.address
    );

    isMember.result.expectBool(true);
  }
});

Clarinet.test({
  name: "Test approve-membership: Prevent unauthorized membership approval",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    const createBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'create-community', [
        types.ascii('GamersUnite'),
        types.ascii('A community for passionate gamers'),
        types.uint(100)
      ], deployer.address)
    ]);

    const requestMembershipBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'request-membership', [
        types.ascii('GamersUnite')
      ], wallet1.address)
    ]);

    const approveMembershipBlock = chain.mineBlock([
      Tx.contractCall('community-registry', 'approve-membership', [
        types.ascii('GamersUnite'),
        types.principal(wallet1.address)
      ], wallet2.address)
    ]);

    approveMembershipBlock.receipts[0].result.expectErr().expectUint(403); // ERR_UNAUTHORIZED
  }
});