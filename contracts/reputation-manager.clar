;; GameGuard Reputation Management Contract
;; Purpose: Secure and transparent reputation tracking for gaming communities
;; Version: 1.0.0

;; Error Codes
(define-constant ERR_UNAUTHORIZED u1000)
(define-constant ERR_INVALID_REPUTATION_CHANGE u1001)
(define-constant ERR_THRESHOLD_VIOLATION u1002)
(define-constant ERR_REPUTATION_NOT_FOUND u1003)

;; Constants
(define-constant MAX_REPUTATION u1000)
(define-constant MIN_REPUTATION u0)
(define-constant REPUTATION_HISTORY_LIMIT u10)

;; Maps
;; Tracks user reputation data
(define-map user-reputations 
    principal 
    {
        current-score: uint,
        total-actions: uint,
        positive-actions: uint,
        negative-actions: uint
    }
)

;; Tracks reputation modification history
(define-map reputation-history 
    (tuple (user principal) (timestamp uint))
    (tuple 
        (old-score uint)
        (new-score uint)
        (action-type (string-ascii 50))
    )
)

;; Admin Principal (Contract Deployer)
(define-data-var admin-principal principal tx-sender)

;; Authorization Check
(define-private (is-admin (sender principal))
    (is-eq sender (var-get admin-principal))
)

;; Get User Reputation
(define-read-only (get-user-reputation (user principal))
    (map-get? user-reputations user)
)

;; Validate Reputation Change
(define-private (validate-reputation-change 
    (current-score uint) 
    (change-amount uint) 
    (is-positive bool)
)
    (let 
        (
            (new-score 
                (if is-positive 
                    (min (+ current-score change-amount) MAX_REPUTATION)
                    (max (- current-score change-amount) MIN_REPUTATION)
                )
            )
        )
        (asserts! (and (>= new-score MIN_REPUTATION) (<= new-score MAX_REPUTATION)) 
            (err ERR_INVALID_REPUTATION_CHANGE))
        (ok new-score)
    )
)

;; Modify User Reputation
(define-public (modify-reputation 
    (user principal) 
    (change-amount uint) 
    (is-positive bool)
    (action-type (string-ascii 50))
)
    (begin
        ;; Authorization: Only admin or contract can modify reputation
        (asserts! (or (is-admin tx-sender) (is-eq tx-sender (var-get admin-principal))) 
            (err ERR_UNAUTHORIZED))
        
        (match (map-get? user-reputations user)
            current-rep
            (let 
                (
                    (validation-result 
                        (validate-reputation-change 
                            (get current-score current-rep) 
                            change-amount 
                            is-positive
                        )
                    )
                    (new-score 
                        (unwrap! validation-result (err ERR_INVALID_REPUTATION_CHANGE))
                    )
                )
                ;; Update reputation map
                (map-set user-reputations user 
                    {
                        current-score: new-score,
                        total-actions: (+ (get total-actions current-rep) u1),
                        positive-actions: 
                            (if is-positive 
                                (+ (get positive-actions current-rep) u1) 
                                (get positive-actions current-rep)
                            ),
                        negative-actions: 
                            (if (not is-positive) 
                                (+ (get negative-actions current-rep) u1) 
                                (get negative-actions current-rep)
                            )
                    }
                )
                
                ;; Record reputation history
                (map-set reputation-history 
                    {user: user, timestamp: block-height} 
                    {
                        old-score: (get current-score current-rep),
                        new-score: new-score,
                        action-type: action-type
                    }
                )
                
                (ok new-score)
            )
            ;; If no existing reputation, create new entry
            (let 
                (
                    (initial-score 
                        (if is-positive 
                            change-amount 
                            (- MIN_REPUTATION change-amount)
                        )
                    )
                )
                (map-set user-reputations user 
                    {
                        current-score: initial-score,
                        total-actions: u1,
                        positive-actions: (if is-positive u1 u0),
                        negative-actions: (if (not is-positive) u1 u0)
                    }
                )
                
                (map-set reputation-history 
                    {user: user, timestamp: block-height} 
                    {
                        old-score: u0,
                        new-score: initial-score,
                        action-type: action-type
                    }
                )
                
                (ok initial-score)
            )
        )
    )
)

;; Check Reputation Threshold
(define-read-only (check-reputation-threshold 
    (user principal) 
    (minimum-score uint)
)
    (match (map-get? user-reputations user)
        rep
        (>= (get current-score rep) minimum-score)
        false
    )
)

;; Transfer Admin Rights
(define-public (transfer-admin (new-admin principal))
    (begin
        (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
        (var-set admin-principal new-admin)
        (ok true)
    )
)

;; Initialize contract with deployer as admin
(var-set admin-principal tx-sender)