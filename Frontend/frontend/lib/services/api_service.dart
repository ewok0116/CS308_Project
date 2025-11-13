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