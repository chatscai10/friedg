const admin = require("firebase-admin");

/**
 * Middleware to check if the user is authenticated via Firebase Auth.
 * Attaches decoded token to req.user.
 */
exports.checkAuth = async (req, res, next) => {
  console.log("Middleware: checkAuth");
  const idToken = req.headers.authorization?.split("Bearer ")[1];

  if (!idToken) {
    return res.status(401).send({ message: "Unauthorized: No token provided." });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // --- DEBUG LOG: Inspect decodedToken --- 
    console.log("--- Decoded Token Content ---");
    console.dir(decodedToken, { depth: null }); // Print the full object
    console.log("--- End Decoded Token --- ");
    // --- END DEBUG LOG ---

    if (!decodedToken) { // Add a check in case verifyIdToken returns null/undefined
        console.error("verifyIdToken returned null or undefined.");
        return res.status(403).send({ message: "Forbidden: Invalid token (could not decode)." });
    }

    // Fetch the full UserRecord to get standard properties like phoneNumber
    const userRecord = await admin.auth().getUser(decodedToken.uid);

    // Combine standard info and custom claims into req.user
    req.user = {
      uid: userRecord.uid,
      email: userRecord.email, // Add email if needed
      phoneNumber: userRecord.phoneNumber, // Add phoneNumber
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      disabled: userRecord.disabled,
      // Include custom claims from the decoded token
      ...(decodedToken || {}), // Spread decodedToken, handle if verifyIdToken somehow returned null/undefined
      // Ensure essential custom claims are present, potentially overriding decodedToken if necessary
      // (though verifyIdToken usually includes them reliably)
      role: decodedToken.role,
      tenantId: decodedToken.tenantId,
      storeId: decodedToken.storeId,
    };

    // Remove redundant uid from the spread if it exists in decodedToken to avoid conflict (should be same)
    // delete req.user.uid; // This might be unnecessary if uid isn't a custom claim

    console.log("User authenticated:", req.user.uid, "Role:", req.user.role, "Phone:", req.user.phoneNumber);
    next();
  } catch (error) {
    console.error("Error during authentication check:", error);
    if (error.code === 'auth/user-not-found') {
        // This could happen if the user was deleted after the token was issued but before verification
        return res.status(404).send({ message: "Forbidden: User associated with token not found." });
    }
    // Distinguish token verification errors from getUser errors if needed
    return res.status(403).send({ message: "Forbidden: Invalid token or user lookup failed." });
  }
};

/**
 * Middleware factory to check if the authenticated user has one of the required roles.
 * Assumes checkAuth middleware runs first and attaches user to req.
 * @param {string[]} requiredRoles Array of allowed role strings.
 */
exports.checkRole = (requiredRoles) => {
  return (req, res, next) => {
    console.log(`Middleware: checkRole (Required: ${requiredRoles.join(", ")})`);
    if (!req.user) {
      console.error("checkRole middleware called without authenticated user.");
      return res.status(403).send({ message: "Forbidden: Authentication required." });
    }

    const userRole = req.user.role; // Assumes role is set in custom claims
    if (!userRole || !requiredRoles.includes(userRole)) {
      console.warn(`Authorization failed for user ${req.user.uid}. Role '${userRole}' not in [${requiredRoles.join(", ")}]`);
      return res.status(403).send({ message: "Forbidden: Insufficient permissions." });
    }

    console.log(`User ${req.user.uid} authorized with role: ${userRole}`);
    next();
  };
};

// TODO: Add more specific permission checks if needed, e.g., checkTenantAccess, checkStoreAccess
