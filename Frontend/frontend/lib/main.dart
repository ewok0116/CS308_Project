import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Firebase.initializeApp(
    options: FirebaseOptions(
      apiKey: "AIzaSyBJWPpOC95imcMPN_wydMBuVR6PSnexh-c",
      authDomain: "cs308-store.firebaseapp.com",
      projectId: "cs308-store",
      storageBucket: "cs308-store.firebasestorage.app",
      messagingSenderId: "622183565730",
      appId: "1:622183565730:web:4cf4e26cb439ad2a364afb",
      measurementId: "G-D87PLC55D",
    ),
  );
  
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CS308 Store',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: Color(0xFFFF7733),
        scaffoldBackgroundColor: Color(0xFFFFF5E6),
        colorScheme: ColorScheme.fromSwatch().copyWith(
          primary: Color(0xFFFF7733),
          secondary: Color(0xFFFF7733),
        ),
      ),
      home: HomeScreen(),
    );
  }
}