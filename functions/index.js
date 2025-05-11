const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
admin.initializeApp();

exports.createDoctor = functions.https.onCall({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be authenticated to perform this action.",
    );
  }

  try {
    // Fetch user data from Firestore to check role
    const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(context.auth.uid)
        .get();

    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new functions.https.HttpsError(
          "permission-denied",
          "You must be an admin to perform this action.",
      );
    }

    // Validate input data
    const {
      firstName,
      lastName,
      email,
      password,
      specialization,
      hospital,
    } = data;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !specialization ||
      !hospital
    ) {
      throw new functions.https.HttpsError(
          "invalid-argument",
          "All fields (firstName, lastName, email, password, specialization, " +
          "hospital) are required.",
      );
    }

    if (password.length < 6) {
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Password must be at least 6 characters long.",
      );
    }

    // Create the new user in Firebase Authentication
    const user = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
    });

    // Store user data in Firestore
    await admin.firestore().collection("users").doc(user.uid).set({
      firstName,
      lastName,
      email,
      uid: user.uid,
      role: "doctor",
      specialization,
      hospital,
      createdBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      uid: user.uid,
      message: "Doctor created successfully.",
    };
  } catch (error) {
    console.error("Error creating doctor:", error);
    throw new functions.https.HttpsError(
        "internal",
        error.message || "An error occurred while creating the doctor.",
    );
  }
});

exports.deleteUser = functions.https.onCall({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be authenticated to perform this action.",
    );
  }

  try {
    const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(context.auth.uid)
        .get();

    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new functions.https.HttpsError(
          "permission-denied",
          "You must be an admin to perform this action.",
      );
    }

    const {uid} = data;
    if (!uid) {
      throw new functions.https.HttpsError(
          "invalid-argument",
          "User ID is required.",
      );
    }

    // Delete from Authentication
    await admin.auth().deleteUser(uid);

    // Delete from Firestore
    await admin.firestore().collection("users").doc(uid).delete();
    return {success: true, message: "User deleted successfully."};
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new functions.https.HttpsError(
        "internal",
        error.message || "An error occurred while deleting the user.",
    );
  }
});
