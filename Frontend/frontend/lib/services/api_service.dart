
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:3000';

  // Get auth token from Firebase
  Future<String?> _getAuthToken() async {
    User? user = FirebaseAuth.instance.currentUser;
    if (user == null) return null;
    return await user.getIdToken();
  }

  // Get user role from backend
  Future<String> getUserRole(String uid) async {
    try {
      final token = await _getAuthToken();
      final response = await http.get(
        Uri.parse('$baseUrl/users/$uid/role'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['role'] ?? 'customer';
      }
      return 'customer';
    } catch (e) {
      print('Error getting user role: $e');
      return 'customer';
    }
  }

  // Set user role (for signup)
  Future<void> setUserRole(String uid, String role) async {
    try {
      final token = await _getAuthToken();
      await http.put(
        Uri.parse('$baseUrl/users/$uid/role'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'role': role}),
      );
    } catch (e) {
      print('Error setting user role: $e');
    }
  }

  Future<List<dynamic>> getProducts() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/collections/products'),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        print('Got ${data['documents']?.length ?? 0} products');
        return data['documents'] ?? [];
      }
      throw Exception('Failed to load products: ${response.statusCode}');
    } catch (e) {
      print('Error loading products: $e');
      rethrow;
    }
  }

  Future<List<dynamic>> getCategories() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/collections/categories'),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['documents'] ?? [];
      }
      throw Exception('Failed to load categories');
    } catch (e) {
      print('Error loading categories: $e');
      rethrow;
    }
  }
}



/*
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'http://localhost:3000';

  Future<List<dynamic>> getProducts() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/collections/products'),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        print('Got ${data['documents']?.length ?? 0} products');
        return data['documents'] ?? [];
      }
      throw Exception('Failed to load products: ${response.statusCode}');
    } catch (e) {
      print('Error loading products: $e');
      rethrow;
    }
  }

  Future<List<dynamic>> getCategories() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/collections/categories'),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['documents'] ?? [];
      }
      throw Exception('Failed to load categories');
    } catch (e) {
      print('Error loading categories: $e');
      rethrow;
    }
  }
}
*/