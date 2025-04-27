;; GameGuard: Community Registry Smart Contract
;; A secure platform for managing gaming communities

;; Error Codes
(define-constant ERR_UNAUTHORIZED (err u403))
(define-constant ERR_COMMUNITY_EXISTS (err u409))
(define-constant ERR_COMMUNITY_NOT_FOUND (err u404))
(define-constant ERR_MAX_MEMBERS_REACHED (err u429))
(define-constant ERR_ALREADY_MEMBER (err u412))
(define-constant ERR_NOT_MEMBER (err u412))

;; Data Structures
;; Community metadata and membership tracking
(define-map communities 
  {name: (string-ascii 50)} 
  {
    description: (string-ascii 500),
    creator: principal,
    max-members: uint,
    administrators: (list 10 principal)
  }
)

(define-map community-members 
  {community-name: (string-ascii 50), member: principal} 
  {status: (string-ascii 20)}
)

;; Private Helper Functions
(define-private (is-in-list (item principal) (list (list 10 principal)))
  (fold 
    (lambda (check-principal result)
      (if result 
          true 
          (is-eq item check-principal)
      )
    )
    list 
    false
  )
)

(define-private (is-community-admin (community-name (string-ascii 50)) (user principal))
  (let ((community (map-get? communities {name: community-name})))
    (match community
      details (is-in-list user (get administrators details))
      false
    )
  )
)

;; Public Functions
;; Create a new gaming community
(define-public (create-community 
  (name (string-ascii 50)) 
  (description (string-ascii 500)) 
  (max-members uint)
)
  (begin
    ;; Prevent duplicate communities
    (asserts! (is-none (map-get? communities {name: name})) ERR_COMMUNITY_EXISTS)
    
    ;; Create community with sender as first administrator
    (map-set communities 
      {name: name}
      {
        description: description, 
        creator: tx-sender, 
        max-members: max-members,
        administrators: (list tx-sender)
      }
    )
    
    (ok true)
  )
)

;; Add an administrator to a community
(define-public (add-administrator 
  (community-name (string-ascii 50)) 
  (new-admin principal)
)
  (let ((community (map-get? communities {name: community-name})))
    (match community
      details
        (begin
          ;; Only current administrators can add new administrators
          (asserts! (is-community-admin community-name tx-sender) ERR_UNAUTHORIZED)
          
          ;; Check if new admin is already in list to prevent duplicates
          (asserts! 
            (not (contains new-admin (get administrators details))) 
            (err u409)
          )
          
          ;; Update administrators list
          (map-set communities 
            {name: community-name}
            (merge details {
              administrators: (unwrap! 
                (as-max-len? 
                  (append (get administrators details) new-admin) 
                  u10
                ) 
                (err u429)
              )
            })
          )
          
          (ok true)
        )
      ERR_COMMUNITY_NOT_FOUND
    )
  )
)

;; Request to join a community
(define-public (request-membership 
  (community-name (string-ascii 50))
)
  (let ((community (map-get? communities {name: community-name})))
    (match community
      details
        (begin
          ;; Check member count limit
          (asserts! 
            (< 
              (len (filter is-approved-member (map-keys community-members))) 
              (get max-members details)
            ) 
            ERR_MAX_MEMBERS_REACHED
          )
          
          ;; Prevent duplicate membership requests
          (asserts! 
            (is-none (map-get? community-members 
              {community-name: community-name, member: tx-sender}
            )) 
            ERR_ALREADY_MEMBER
          )
          
          ;; Add membership request
          (map-set community-members 
            {community-name: community-name, member: tx-sender}
            {status: "pending"}
          )
          
          (ok true)
        )
      ERR_COMMUNITY_NOT_FOUND
    )
  )
)

;; Approve a membership request
(define-public (approve-membership 
  (community-name (string-ascii 50)) 
  (member principal)
)
  (begin
    ;; Only administrators can approve members
    (asserts! 
      (is-community-admin community-name tx-sender) 
      ERR_UNAUTHORIZED
    )
    
    ;; Validate membership request exists and is pending
    (asserts! 
      (is-eq 
        (get status (map-get? community-members 
          {community-name: community-name, member: member}
        )) 
        (some "pending")
      ) 
      ERR_NOT_MEMBER
    )
    
    ;; Update membership status
    (map-set community-members 
      {community-name: community-name, member: member}
      {status: "approved"}
    )
    
    (ok true)
  )
)

;; Read-only Functions
(define-read-only (get-community-details (name (string-ascii 50)))
  (map-get? communities {name: name})
)

(define-read-only (is-community-member (community-name (string-ascii 50)) (user principal))
  (is-eq 
    (get status (map-get? community-members 
      {community-name: community-name, member: user}
    )) 
    (some "approved")
  )
)

(define-read-only (get-community-administrators (name (string-ascii 50)))
  (match (map-get? communities {name: name})
    details (get administrators details)
    (list)
  )
)

;; Private Check Functions
(define-private (is-approved-member (key {community-name: (string-ascii 50), member: principal}))
  (is-eq 
    (get status (map-get? community-members key)) 
    (some "approved")
  )
)