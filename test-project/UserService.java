@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    
    public User findById(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
    
    public User save(User user) {
        validateUser(user);
        return userRepository.save(user);
    }
    
    public void deleteById(Long id) {
        userRepository.deleteById(id);
        logDeletion(id);
    }
    
    private void validateUser(User user) {
        // Validation logic
    }
    
    private void logDeletion(Long id) {
        // Logging logic
    }
}
