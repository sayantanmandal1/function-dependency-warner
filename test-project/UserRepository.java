@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Spring Data JPA will implement these methods
    Optional<User> findById(Long id);
    User save(User user);
    void deleteById(Long id);
}
